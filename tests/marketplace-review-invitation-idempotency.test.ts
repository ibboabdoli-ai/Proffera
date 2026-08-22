import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  sendReviewEmail: vi.fn(),
  createReviewToken: vi.fn(),
  hashReviewToken: vi.fn(),
  publicBaseUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/features/email/review-invitation-email", () => ({ sendVerifiedReviewInvitationEmail: mocks.sendReviewEmail }));
vi.mock("@/lib/verified-review-token", () => ({
  createVerifiedReviewToken: mocks.createReviewToken,
  hashVerifiedReviewToken: mocks.hashReviewToken,
}));
vi.mock("@/lib/marketplace-public-base-url", () => ({ resolveMarketplacePublicBaseUrl: mocks.publicBaseUrl }));

import { deliverMarketplaceServiceJobReviewInvitation } from "@/lib/marketplace-verified-review";

type TransactionBuilder = (
  txn: (strings: TemplateStringsArray, ...values: unknown[]) => unknown[],
) => unknown[][];

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

function sqlResponses(...responses: unknown[][]) {
  let index = 0;
  const transactionQueries: unknown[][] = [];
  const sql = vi.fn(async () => responses[index++] ?? []);
  const transaction = vi.fn(async (builder: TransactionBuilder) => {
    const txn = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const call: unknown[] = [strings, ...values];
      transactionQueries.push(call);
      return call;
    };
    const queries = builder(txn);
    return queries.map(() => responses[index++] ?? []);
  });
  return Object.assign(sql, { transaction, transactionQueries });
}

const jobId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const invitationRow = {
  service_job_id: jobId,
  contact_name: "Anna",
  contact_email: "anna@example.com",
  request_locale: "en",
  display_name: "Pipe AB",
  public_slug: "pipe-ab",
  service_name: "Plumber",
  existing_status: null,
  existing_expires_at: null,
  invitation_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
};

describe("Marketplace review invitation idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createReviewToken.mockReturnValue("review-token");
    mocks.hashReviewToken.mockReturnValue("f".repeat(64));
    mocks.publicBaseUrl.mockReturnValue("https://www.proffera.se");
    mocks.sendReviewEmail.mockResolvedValue({ ok: true, providerId: "mail-1" });
  });

  it("acquires the advisory lock before reading or upserting the invitation", async () => {
    const sql = sqlResponses([], [{
      ...invitationRow,
      existing_status: "pending",
      existing_expires_at: "2099-01-01T00:00:00Z",
      invitation_id: null,
    }]);
    mocks.getSql.mockReturnValue(sql);

    await expect(deliverMarketplaceServiceJobReviewInvitation(jobId))
      .resolves.toEqual({ ok: true, code: "already_pending" });

    expect(sql.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    expect(sql.transactionQueries).toHaveLength(2);
    expect(queryText(sql.transactionQueries[0])).toContain("pg_advisory_xact_lock");
    const invitationQuery = queryText(sql.transactionQueries[1]);
    expect(invitationQuery).toContain("website_review_invitations");
    expect(invitationQuery).toContain("existing.status = 'pending' and existing.expires_at > now()");
    expect(invitationQuery).toContain("website_review_invitations.status = 'pending'");
    expect(mocks.sendReviewEmail).not.toHaveBeenCalled();
    expect(sql).not.toHaveBeenCalled();
  });

  it("revokes a newly generated invitation when delivery fails so a later retry can safely rotate it", async () => {
    const sql = sqlResponses([], [invitationRow], [], []);
    mocks.getSql.mockReturnValue(sql);
    mocks.sendReviewEmail.mockResolvedValue({ ok: false, code: "provider_error" });

    await expect(deliverMarketplaceServiceJobReviewInvitation(jobId))
      .resolves.toEqual({ ok: false, code: "email" });

    expect(queryText(sql.transactionQueries[0])).toContain("pg_advisory_xact_lock");
    expect(queryText(sql.transactionQueries[1])).toContain("website_review_invitations");
    expect(queryText(sql.mock.calls[0])).toContain("set status = 'revoked'");
    expect(queryText(sql.mock.calls[0])).toContain("token_hash =");
    expect(queryText(sql.mock.calls[1])).toContain("review_invited");
  });
});
