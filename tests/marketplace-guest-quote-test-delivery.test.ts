import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emailConfigured: vi.fn(),
  getSql: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-secret", () => ({ resolveCustomerPortalSecret: () => "controlled-test-secret" }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  isMarketplaceBusinessRecipientEmail: () => true,
  normalizeMarketplaceRecipientEmail: (value: string) => value.trim().toLowerCase(),
}));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  marketplaceGuestInvitationEmailConfigured: mocks.emailConfigured,
  sendMarketplaceGuestInvitationEmail: mocks.sendEmail,
}));

import { sendMarketplaceGuestQuoteTestInvitation } from "@/lib/marketplace-guest-quote-test";

type SqlQuery = { strings: readonly string[] };

function queryText(query: SqlQuery | undefined) {
  return (query?.strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

function sqlWithReservation(reserved: boolean) {
  const transaction = vi.fn(async (_queries: SqlQuery[]) => {
    void _queries;
    return [[], [{ reserved }]];
  });
  return Object.assign(
    vi.fn((strings: TemplateStringsArray) => ({ strings })),
    { transaction },
  );
}

describe("controlled Guest Quote test delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.emailConfigured.mockReturnValue(true);
    mocks.sendEmail.mockResolvedValue({ ok: true, providerMessageId: "provider-1" });
  });

  it("takes the recipient lock before a fresh reservation check in one database transaction", async () => {
    const sql = sqlWithReservation(true);
    mocks.getSql.mockReturnValue(sql);

    const result = await sendMarketplaceGuestQuoteTestInvitation({
      adminUserId: "super-admin",
      recipientEmail: "test@company.test",
      baseUrl: "https://www.proffera.se",
      language: "en",
    });

    expect(result).toEqual({ ok: true });
    expect(sql.transaction).toHaveBeenCalledTimes(1);
    const queries = sql.transaction.mock.calls[0]?.[0] as SqlQuery[] | undefined;
    expect(queryText(queries?.[0])).toContain("pg_advisory_xact_lock");
    expect(queryText(queries?.[1])).toContain("recent_reservation");
    expect(queryText(queries?.[1])).not.toContain("pg_advisory_xact_lock");
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      language: "en",
      replyUrl: expect.stringContaining("?lang=en"),
      testMode: true,
    }));
  });

  it("does not deliver when the transaction reports a recent reservation", async () => {
    const sql = sqlWithReservation(false);
    mocks.getSql.mockReturnValue(sql);

    const result = await sendMarketplaceGuestQuoteTestInvitation({
      adminUserId: "super-admin",
      recipientEmail: "test@company.test",
      baseUrl: "https://www.proffera.se",
    });

    expect(result).toEqual({ ok: false, code: "rate_limited" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
