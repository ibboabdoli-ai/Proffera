import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getCurrentView: vi.fn(),
  suppressCurrent: vi.fn(),
  hashToken: vi.fn(() => "a".repeat(64)),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  getMarketplaceGuestOptOutView: mocks.getCurrentView,
  suppressMarketplaceGuestRecipient: mocks.suppressCurrent,
  hashMarketplaceGuestToken: mocks.hashToken,
}));

import {
  getMarketplaceGuestOptOutViewWithHistory,
  suppressMarketplaceGuestRecipientWithHistory,
} from "@/lib/marketplace-guest-opt-out-history";

const token = "historical-opt-out-token-value-1234567890";

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/gu, " ").trim();
}

function sqlWithResponses(...responses: unknown[][]) {
  let index = 0;
  const sql = vi.fn(async () => responses[index++] ?? []) as ReturnType<typeof vi.fn> & {
    transaction: ReturnType<typeof vi.fn>;
  };
  sql.transaction = vi.fn(async () => []);
  return sql;
}

describe("marketplace guest historical opt-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSql.mockReset();
    mocks.getCurrentView.mockReset();
    mocks.suppressCurrent.mockReset();
    mocks.hashToken.mockReturnValue("a".repeat(64));
  });

  it("loads an already-delivered historical opt-out token when the current invitation token changed", async () => {
    mocks.getCurrentView.mockResolvedValue(null);
    const sql = sqlWithResponses([
      { display_name: "Historiskt Företag AB", status: "expired" },
    ]);
    mocks.getSql.mockReturnValue(sql);

    const view = await getMarketplaceGuestOptOutViewWithHistory(token);

    expect(view).toEqual({
      status: "expired",
      companyName: "Historiskt Företag AB",
    });
    expect(queryText(sql.mock.calls[0])).toContain("marketplace_guest_opt_out_credentials");
    expect(mocks.hashToken).toHaveBeenCalledWith(token);
  });

  it("suppresses the historical recipient address when the old emailed token is submitted", async () => {
    mocks.suppressCurrent.mockResolvedValue({ ok: false, code: "invalid" });
    const invitationId = "11111111-1111-4111-8111-111111111111";
    const profileId = "22222222-2222-4222-8222-222222222222";
    const recipientEmail = "old-contact@example.se";
    const sql = sqlWithResponses(
      [{
        invitation_id: invitationId,
        profile_id: profileId,
        recipient_email_normalized: recipientEmail,
      }],
      [],
    );
    mocks.getSql.mockReturnValue(sql);

    const result = await suppressMarketplaceGuestRecipientWithHistory(token);

    expect(result).toEqual({ ok: true });
    expect(mocks.hashToken).toHaveBeenCalledWith(token);
    expect(queryText(sql.mock.calls[0])).toContain("marketplace_guest_opt_out_credentials");
    expect(sql.mock.calls[0]?.slice(1)).toEqual(["a".repeat(64)]);
    expect(sql.transaction).toHaveBeenCalledTimes(1);
    const transactionQueries = sql.transaction.mock.calls[0]?.[0] as unknown[];
    expect(transactionQueries).toHaveLength(2);

    const insertCall = sql.mock.calls[1] ?? [];
    expect(queryText(insertCall)).toContain("marketplace_outreach_suppressions");
    expect(insertCall.slice(1)).toEqual([profileId, recipientEmail, invitationId]);
    expect(queryText(sql.mock.calls.at(-1))).toContain("status = 'pending'");
  });

  it("rejects an invalid token before any database access", async () => {
    const result = await suppressMarketplaceGuestRecipientWithHistory("bad-token");

    expect(result).toEqual({ ok: false, code: "invalid" });
    expect(mocks.suppressCurrent).not.toHaveBeenCalled();
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("uses the current opt-out path without touching history when the current token is still valid", async () => {
    mocks.getCurrentView.mockResolvedValue({ status: "sent", companyName: "Nuvarande Företag AB" });

    const view = await getMarketplaceGuestOptOutViewWithHistory(token);

    expect(view).toEqual({ status: "sent", companyName: "Nuvarande Företag AB" });
    expect(mocks.getSql).not.toHaveBeenCalled();
  });
});