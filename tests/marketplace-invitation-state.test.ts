import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSql: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import {
  expirePastMarketplaceInvitation,
  getMarketplaceInvitationSummaries,
} from "@/features/matching/marketplace-invitation-state";

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

describe("marketplace invitation persisted state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts recorded waves and exposes blocking state per candidate", async () => {
    const quoteId = "11111111-1111-4111-8111-111111111111";
    const sql = vi.fn(async () => [
      {
        quote_request_id: quoteId,
        profile_id: "22222222-2222-4222-8222-222222222222",
        status: "sent",
        wave: 1,
        expires_at: "2099-01-01T00:00:00.000Z",
        blocking: true,
      },
      {
        quote_request_id: quoteId,
        profile_id: "33333333-3333-4333-8333-333333333333",
        status: "expired",
        wave: 1,
        expires_at: "2026-01-01T00:00:00.000Z",
        blocking: false,
      },
      {
        quote_request_id: quoteId,
        profile_id: "44444444-4444-4444-8444-444444444444",
        status: "delivery_uncertain",
        wave: 2,
        expires_at: "2026-01-01T00:00:00.000Z",
        blocking: true,
      },
    ]);
    mocks.getSql.mockReturnValue(sql);

    const summaries = await getMarketplaceInvitationSummaries([quoteId]);
    const summary = summaries.get(quoteId);

    expect(summary?.wave1Count).toBe(2);
    expect(summary?.wave2Count).toBe(1);
    expect(summary?.totalCount).toBe(3);
    expect(summary?.byProfile.get("22222222-2222-4222-8222-222222222222")?.blocking).toBe(true);
    expect(summary?.byProfile.get("33333333-3333-4333-8333-333333333333")?.blocking).toBe(false);
    expect(summary?.byProfile.get("44444444-4444-4444-8444-444444444444")?.blocking).toBe(true);
    expect(queryText(sql.mock.calls[0])).toContain("from marketplace_quote_invitations");
  });

  it("expires only elapsed sent/viewed links and leaves ambiguous dispatch states alone", async () => {
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);

    await expirePastMarketplaceInvitation(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    );

    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("expires_at <= now()");
    expect(query).toContain("status in ('sent', 'viewed')");
    expect(query).not.toContain("delivery_uncertain");
    expect(query).not.toContain("status in ('pending'");
  });
});
