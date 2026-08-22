import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSql: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import {
  applyMarketplaceRematchContext,
  finalizeMarketplaceRematchWork,
  prepareMarketplaceRematchWork,
  type MarketplaceRematchWorkerContext,
} from "@/lib/marketplace-rematch-worker";

function sqlResponses(...responses: unknown[][]) {
  let index = 0;
  return vi.fn(async () => responses[index++] ?? []);
}

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

describe("Marketplace rematch worker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("claims pending rematches with a lease and activates the fresh quote generation", async () => {
    const sql = sqlResponses(
      [{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        source_quote_request_id: "11111111-1111-4111-8111-111111111111",
        rematch_quote_request_id: "22222222-2222-4222-8222-222222222222",
      }],
      [{
        quote_request_id: "11111111-1111-4111-8111-111111111111",
        profile_id: "33333333-3333-4333-8333-333333333333",
        recipient_email: "old@example.se",
      }],
    );
    mocks.getSql.mockReturnValue(sql);

    const context = await prepareMarketplaceRematchWork(5);

    expect(context.get("22222222-2222-4222-8222-222222222222")?.excludedProfileIds)
      .toContain("33333333-3333-4333-8333-333333333333");
    expect(context.get("22222222-2222-4222-8222-222222222222")?.excludedRecipientEmails)
      .toContain("old@example.se");
    expect(queryText(sql.mock.calls[0])).toContain("for update of rematch skip locked");
    expect(queryText(sql.mock.calls[0])).toContain("set status = 'processing'");
    expect(queryText(sql.mock.calls[0])).toContain("set status = 'submitted'");
  });

  it("prioritizes rematches and removes every provider/mailbox used by the source generation", () => {
    const context: MarketplaceRematchWorkerContext = new Map([
      ["rematch-quote", {
        rematchId: "rematch-id",
        sourceQuoteRequestId: "source-quote",
        rematchQuoteRequestId: "rematch-quote",
        excludedProfileIds: new Set(["old-profile"]),
        excludedRecipientEmails: new Set(["second-old@example.se"]),
      }],
    ]);
    const matches = [
      {
        lead: { id: "normal-quote" },
        candidates: [{ profileId: "normal-profile", recipientEmail: "new@example.se" }],
      },
      {
        lead: { id: "rematch-quote" },
        candidates: [
          { profileId: "old-profile", recipientEmail: "other@example.se" },
          { profileId: "different-profile", recipientEmail: "SECOND-OLD@example.se" },
          { profileId: "new-profile", recipientEmail: "fresh@example.se" },
        ],
      },
    ] as never[];

    const routed = applyMarketplaceRematchContext(matches, context);

    expect(routed[0]?.lead.id).toBe("rematch-quote");
    expect(routed[0]?.candidates).toEqual([
      expect.objectContaining({ profileId: "new-profile", recipientEmail: "fresh@example.se" }),
    ]);
  });

  it("marks a rematch processed only after a persisted invitation exists and returns empty runs to pending", async () => {
    const sql = sqlResponses([]);
    mocks.getSql.mockReturnValue(sql);
    const context: MarketplaceRematchWorkerContext = new Map([
      ["22222222-2222-4222-8222-222222222222", {
        rematchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        sourceQuoteRequestId: "11111111-1111-4111-8111-111111111111",
        rematchQuoteRequestId: "22222222-2222-4222-8222-222222222222",
        excludedProfileIds: new Set(),
        excludedRecipientEmails: new Set(),
      }],
    ]);

    await finalizeMarketplaceRematchWork(context);

    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("exists ( select 1 from marketplace_quote_invitations");
    expect(query).toContain("set status = 'processed'");
    expect(query).toContain("set status = 'pending'");
    expect(query).toContain("set status = 'draft'");
  });

  it("does nothing before migration 0064 exists", async () => {
    const missingTable = Object.assign(new Error("missing relation"), { code: "42P01" });
    mocks.getSql.mockReturnValue(vi.fn().mockRejectedValue(missingTable));

    await expect(prepareMarketplaceRematchWork()).resolves.toEqual(new Map());
  });
});
