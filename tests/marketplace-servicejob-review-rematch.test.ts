import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  guestHash: vi.fn(),
  guestValid: vi.fn(),
  customerHash: vi.fn(),
  customerValid: vi.fn(),
  sendReviewEmail: vi.fn(),
  createReviewToken: vi.fn(),
  hashReviewToken: vi.fn(),
  publicBaseUrl: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/marketplace-guest-quote", () => ({ hashMarketplaceGuestToken: mocks.guestHash }));
vi.mock("@/lib/marketplace-guest-opt-out-core", () => ({ isValidMarketplaceGuestToken: mocks.guestValid }));
vi.mock("@/lib/marketplace-customer-comparison", () => ({
  hashMarketplaceCustomerComparisonToken: mocks.customerHash,
  isMarketplaceCustomerComparisonToken: mocks.customerValid,
}));
vi.mock("@/features/email/review-invitation-email", () => ({ sendVerifiedReviewInvitationEmail: mocks.sendReviewEmail }));
vi.mock("@/lib/verified-review-token", () => ({
  createVerifiedReviewToken: mocks.createReviewToken,
  hashVerifiedReviewToken: mocks.hashReviewToken,
}));
vi.mock("@/lib/marketplace-public-base-url", () => ({ resolveMarketplacePublicBaseUrl: mocks.publicBaseUrl }));

import {
  cancelMarketplaceServiceJobByCustomerToken,
  getMarketplaceServiceJobForCustomerToken,
  getMarketplaceServiceJobForGuestToken,
  transitionMarketplaceServiceJobByGuestToken,
} from "@/lib/marketplace-service-jobs";
import {
  getMarketplaceRematchForCustomerToken,
  requestMarketplaceRematchByCustomerToken,
} from "@/lib/marketplace-rematch";
import {
  deliverMarketplaceServiceJobReviewInvitation,
  getMarketplaceVerifiedReviewPreviewByHash,
  submitMarketplaceVerifiedReviewByHash,
} from "@/lib/marketplace-verified-review";
import { moderateMarketplaceVerifiedReview } from "@/lib/marketplace-review-moderation";

type TransactionBuilder = (
  txn: (strings: TemplateStringsArray, ...values: unknown[]) => unknown[],
) => unknown[][];

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

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

const jobRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  status: "accepted",
  service_name: "Rörmokare",
  city: "Södertälje",
  currency: "SEK",
  amount_minor: 150000,
  scheduled_date: "2026-09-01",
  completion_summary: "",
  resolution_reason: "",
  started_at: "",
  completed_at: "",
  cancelled_at: "",
};

const verifiedReviewSubmission = {
  reviewerName: "Anna",
  rating: 5,
  message: "Bra jobb",
  consent: true as const,
  website: "",
  formStartedAt: Date.now() - 10_000,
};

describe("Marketplace ServiceJob lifecycle and security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.guestValid.mockReturnValue(true);
    mocks.guestHash.mockReturnValue("guest-hash");
    mocks.customerValid.mockReturnValue(true);
    mocks.customerHash.mockReturnValue("customer-hash");
    mocks.createReviewToken.mockReturnValue("review-token");
    mocks.hashReviewToken.mockReturnValue("f".repeat(64));
    mocks.publicBaseUrl.mockReturnValue("https://www.proffera.se");
  });

  it("binds provider job access to the selected offer and invitation token", async () => {
    const sql = sqlResponses([jobRow]);
    mocks.getSql.mockReturnValue(sql);
    await expect(getMarketplaceServiceJobForGuestToken("g".repeat(43))).resolves.toMatchObject({ id: jobRow.id });
    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("offer.status = 'selected'");
    expect(query).toContain("job.profile_id = offer.profile_id");
    expect(query).toContain("invitation.token_hash =");
    expect(query).toContain("invitation.expires_at > now()");
  });

  it("does not resolve a loser invitation token to the winner ServiceJob", async () => {
    const sql = sqlResponses([]);
    mocks.getSql.mockReturnValue(sql);

    await expect(getMarketplaceServiceJobForGuestToken("g".repeat(43))).resolves.toBeNull();

    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("offer.invitation_id = invitation.id");
    expect(query).toContain("offer.status = 'selected'");
    expect(query).toContain("job.selected_offer_id = offer.id");
  });

  it("rejects malformed provider and customer tokens before any database lookup", async () => {
    mocks.guestValid.mockReturnValue(false);
    mocks.customerValid.mockReturnValue(false);

    await expect(getMarketplaceServiceJobForGuestToken("guessable-token")).resolves.toBeNull();
    await expect(getMarketplaceServiceJobForCustomerToken("guessable-token")).resolves.toBeNull();
    await expect(transitionMarketplaceServiceJobByGuestToken({
      token: "guessable-token",
      nextStatus: "in_progress",
    })).resolves.toEqual({ ok: false, code: "invalid" });
    await expect(cancelMarketplaceServiceJobByCustomerToken("guessable-token"))
      .resolves.toEqual({ ok: false, code: "invalid" });

    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.guestHash).not.toHaveBeenCalled();
    expect(mocks.customerHash).not.toHaveBeenCalled();
  });

  it("binds customer job access to the secure customer token and selected offer", async () => {
    const sql = sqlResponses([jobRow]);
    mocks.getSql.mockReturnValue(sql);
    await expect(getMarketplaceServiceJobForCustomerToken("c".repeat(43))).resolves.toMatchObject({ id: jobRow.id });
    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("marketplace_quote_customer_access access");
    expect(query).toContain("offer.status = 'selected'");
    expect(query).toContain("access.expires_at > now()");
  });

  it("requires completion evidence and reasons before terminal provider actions", async () => {
    await expect(transitionMarketplaceServiceJobByGuestToken({ token: "g".repeat(43), nextStatus: "completed", completionSummary: "" }))
      .resolves.toEqual({ ok: false, code: "completion_required" });
    await expect(transitionMarketplaceServiceJobByGuestToken({ token: "g".repeat(43), nextStatus: "no_show", reason: "" }))
      .resolves.toEqual({ ok: false, code: "reason_required" });
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("allows the bounded provider lifecycle and logs the transition", async () => {
    const sql = sqlResponses([{ ...jobRow, status: "in_progress", started_at: "2026-08-22T12:00:00Z" }]);
    mocks.getSql.mockReturnValue(sql);
    const result = await transitionMarketplaceServiceJobByGuestToken({
      token: "g".repeat(43),
      nextStatus: "in_progress",
    });
    expect(result.ok).toBe(true);
    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("target.status = 'accepted'");
    expect(query).toContain("target.status = 'in_progress'");
    expect(query).toContain("target.status = 'problem'");
    expect(query).toContain("marketplace_service_job_events");
  });

  it("does not reopen a terminal job when no allowed transition row is returned", async () => {
    mocks.getSql.mockReturnValue(sqlResponses([]));
    await expect(transitionMarketplaceServiceJobByGuestToken({
      token: "g".repeat(43),
      nextStatus: "in_progress",
    })).resolves.toEqual({ ok: false, code: "transition" });
  });

  it("lets only the customer token cancel an active winner job", async () => {
    const sql = sqlResponses([{ ...jobRow, status: "customer_cancelled" }]);
    mocks.getSql.mockReturnValue(sql);
    const result = await cancelMarketplaceServiceJobByCustomerToken("c".repeat(43), "Changed plans");
    expect(result.ok).toBe(true);
    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("access.token_hash =");
    expect(query).toContain("target.status in ('accepted', 'in_progress', 'problem')");
    expect(query).toContain("status = 'customer_cancelled'");
  });

  it("maps a frozen rematch job to a specific result instead of a generic database failure", async () => {
    const guarded = Object.assign(new Error("marketplace_service_job_rematch_already_requested"), { code: "23514" });
    mocks.getSql.mockReturnValue(vi.fn().mockRejectedValue(guarded));

    await expect(transitionMarketplaceServiceJobByGuestToken({
      token: "g".repeat(43),
      nextStatus: "in_progress",
    })).resolves.toEqual({ ok: false, code: "rematch_requested" });
    await expect(cancelMarketplaceServiceJobByCustomerToken("c".repeat(43)))
      .resolves.toEqual({ ok: false, code: "rematch_requested" });
  });
});

describe("Marketplace Rematch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customerValid.mockReturnValue(true);
    mocks.customerHash.mockReturnValue("customer-hash");
  });

  it("serializes rematch creation before cloning customer PII", async () => {
    const row = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "pending",
      source_quote_request_id: "11111111-1111-4111-8111-111111111111",
      rematch_quote_request_id: "22222222-2222-4222-8222-222222222222",
      rematch_reference_id: "PRO-R-ABC123",
      created_at: "2026-08-22T12:00:00Z",
      processed_at: null,
      already_exists: false,
    };
    const sql = sqlResponses([], [row]);
    mocks.getSql.mockReturnValue(sql);

    const result = await requestMarketplaceRematchByCustomerToken({ token: "c".repeat(43), reason: "No show" });
    expect(result).toMatchObject({ ok: true, code: "requested" });
    expect(sql.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    expect(queryText(sql.transactionQueries[0])).toContain("pg_advisory_xact_lock");
    expect(queryText(sql.transactionQueries[0])).toContain("job.id::text");
    const query = queryText(sql.transactionQueries[1]);
    expect(query).toContain("insert into quote_requests");
    expect(query).toContain("target.locale");
    expect(query).toContain("'draft'");
    expect(query).toContain("insert into marketplace_rematch_requests");
    expect(query).toContain("not exists (select 1 from existing)");
    expect(query).not.toContain("update marketplace_quote_offers");
  });

  it("is idempotent for duplicate/racing customer requests", async () => {
    const sql = sqlResponses([], [{
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "pending",
      source_quote_request_id: "11111111-1111-4111-8111-111111111111",
      rematch_quote_request_id: "22222222-2222-4222-8222-222222222222",
      rematch_reference_id: "PRO-R-ABC123",
      created_at: "2026-08-22T12:00:00Z",
      processed_at: null,
      already_exists: true,
    }]);
    mocks.getSql.mockReturnValue(sql);
    await expect(requestMarketplaceRematchByCustomerToken({ token: "c".repeat(43) }))
      .resolves.toMatchObject({ ok: true, code: "already_requested" });
    expect(queryText(sql.transactionQueries[0])).toContain("pg_advisory_xact_lock");
  });

  it("keeps direct source Quote Request purges compatible with rematch cascades", () => {
    const migration63 = readFileSync("db/migrations/20260822_0063_marketplace_service_jobs_verified_reviews.sql", "utf8");
    const migration64 = readFileSync("db/migrations/20260822_0064_marketplace_rematch_requests.sql", "utf8");
    expect(migration63).toContain("quote_request_id uuid not null references quote_requests(id) on delete cascade");
    expect(migration64).toContain("service_job_id uuid not null unique references marketplace_service_jobs(id) on delete cascade");
    expect(migration64).toContain("source_quote_request_id uuid not null references quote_requests(id) on delete no action");
    expect(migration64).toContain("rematch_quote_request_id uuid not null unique references quote_requests(id) on delete cascade");
    expect(migration64).not.toContain("source_quote_request_id uuid not null references quote_requests(id) on delete restrict");
  });

  it("reads rematch state only through the same customer access token", async () => {
    const sql = sqlResponses([{
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "processing",
      source_quote_request_id: "11111111-1111-4111-8111-111111111111",
      rematch_quote_request_id: "22222222-2222-4222-8222-222222222222",
      rematch_reference_id: "PRO-R-ABC123",
      created_at: "2026-08-22T12:00:00Z",
      processed_at: null,
    }]);
    mocks.getSql.mockReturnValue(sql);
    await expect(getMarketplaceRematchForCustomerToken("c".repeat(43))).resolves.toMatchObject({ status: "processing" });
    expect(queryText(sql.mock.calls[0])).toContain("access.token_hash =");
  });
});

describe("Verified Review and Reputation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createReviewToken.mockReturnValue("review-token");
    mocks.hashReviewToken.mockReturnValue("f".repeat(64));
    mocks.publicBaseUrl.mockReturnValue("https://www.proffera.se");
    mocks.sendReviewEmail.mockResolvedValue({ ok: true, providerId: "mail-1" });
  });

  it("does not expose a review form before the ServiceJob is completed", async () => {
    mocks.getSql.mockReturnValue(sqlResponses([{
      status: "pending",
      expires_at: "2099-01-01T00:00:00Z",
      service_job_id: jobRow.id,
      job_status: "in_progress",
      service_name: "Rörmokare",
      city: "Södertälje",
      contact_name: "Anna",
      request_locale: "sv",
      display_name: "Rör AB",
      public_slug: "ror-ab",
      review_exists: false,
    }]));
    await expect(getMarketplaceVerifiedReviewPreviewByHash("a".repeat(64)))
      .resolves.toMatchObject({ state: "unavailable", language: "sv" });
  });

  it("keeps English review preview and invitation delivery in English", async () => {
    const previewSql = sqlResponses([{
      status: "pending",
      expires_at: "2099-01-01T00:00:00Z",
      service_job_id: jobRow.id,
      job_status: "completed",
      service_name: "Plumber",
      city: "Stockholm",
      contact_name: "Anna",
      request_locale: "en",
      display_name: "Pipe AB",
      public_slug: "pipe-ab",
      review_exists: false,
    }]);
    mocks.getSql.mockReturnValue(previewSql);
    await expect(getMarketplaceVerifiedReviewPreviewByHash("a".repeat(64)))
      .resolves.toMatchObject({ state: "valid", language: "en" });

    const deliverySql = sqlResponses([], [{
      service_job_id: jobRow.id,
      contact_name: "Anna",
      contact_email: "anna@example.com",
      request_locale: "en",
      display_name: "Pipe AB",
      public_slug: "pipe-ab",
      service_name: "Plumber",
      existing_status: null,
      invitation_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    }], []);
    mocks.getSql.mockReturnValue(deliverySql);
    await expect(deliverMarketplaceServiceJobReviewInvitation(jobRow.id)).resolves.toMatchObject({ ok: true });
    expect(mocks.sendReviewEmail).toHaveBeenCalledWith(expect.objectContaining({
      language: "en",
      reviewUrl: expect.stringContaining("lang=en"),
    }));
  });

  it("accepts exactly one verified review only for a completed job", async () => {
    const sql = sqlResponses([{
      invitation_status: "pending",
      expires_at: "2099-01-01T00:00:00Z",
      job_status: "completed",
      review_exists: false,
      review_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      submitted: true,
    }]);
    mocks.getSql.mockReturnValue(sql);
    const result = await submitMarketplaceVerifiedReviewByHash("a".repeat(64), verifiedReviewSubmission);
    expect(result).toEqual({ ok: true, reviewId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" });
    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("target.job_status = 'completed'");
    expect(query).toContain("existing.review_exists = false");
    expect(query).toContain("on conflict do nothing");
  });

  it("treats an existing verified job review as used", async () => {
    mocks.getSql.mockReturnValue(sqlResponses([{
      invitation_status: "pending",
      expires_at: "2099-01-01T00:00:00Z",
      job_status: "completed",
      review_exists: true,
      review_id: null,
      submitted: false,
    }]));
    await expect(submitMarketplaceVerifiedReviewByHash("a".repeat(64), verifiedReviewSubmission))
      .resolves.toEqual({ ok: false, code: "used" });
  });

  it("returns expired, revoked, invalid and database review submission outcomes", async () => {
    mocks.getSql.mockReturnValue(sqlResponses([{
      invitation_status: "pending",
      expires_at: "2000-01-01T00:00:00Z",
      job_status: "completed",
      review_exists: false,
      review_id: null,
      submitted: false,
    }]));
    await expect(submitMarketplaceVerifiedReviewByHash("a".repeat(64), verifiedReviewSubmission))
      .resolves.toEqual({ ok: false, code: "expired" });

    mocks.getSql.mockReturnValue(sqlResponses([{
      invitation_status: "revoked",
      expires_at: "2099-01-01T00:00:00Z",
      job_status: "completed",
      review_exists: false,
      review_id: null,
      submitted: false,
    }]));
    await expect(submitMarketplaceVerifiedReviewByHash("b".repeat(64), verifiedReviewSubmission))
      .resolves.toEqual({ ok: false, code: "revoked" });

    mocks.getSql.mockReturnValue(sqlResponses([]));
    await expect(submitMarketplaceVerifiedReviewByHash("c".repeat(64), verifiedReviewSubmission))
      .resolves.toEqual({ ok: false, code: "invalid" });

    mocks.getSql.mockReturnValue(sqlResponses([{
      invitation_status: "pending",
      expires_at: "2099-01-01T00:00:00Z",
      job_status: "completed",
      review_exists: false,
      review_id: null,
      submitted: false,
    }]));
    await expect(submitMarketplaceVerifiedReviewByHash("d".repeat(64), verifiedReviewSubmission))
      .resolves.toEqual({ ok: false, code: "database" });
  });

  it("approves only pending verified reviews attached to completed jobs", async () => {
    const reviewId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const sql = sqlResponses([{ id: reviewId, status: "approved" }]);
    mocks.getSql.mockReturnValue(sql);
    await expect(moderateMarketplaceVerifiedReview({
      reviewId,
      decision: "approved",
      adminUserId: "admin-user",
    })).resolves.toEqual({ ok: true, status: "approved" });
    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("review.is_verified = true");
    expect(query).toContain("job.status = 'completed'");
    expect(query).toContain("review.status = 'pending'");
    expect(query).toContain("insert into admin_audit_logs");
  });

  it("rejects a pending verified review without publishing it and audits the decision", async () => {
    const reviewId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const sql = sqlResponses([{ id: reviewId, status: "rejected" }]);
    mocks.getSql.mockReturnValue(sql);

    await expect(moderateMarketplaceVerifiedReview({
      reviewId,
      decision: "rejected",
      adminUserId: "admin-user",
      reason: "Fails moderation",
    })).resolves.toEqual({ ok: true, status: "rejected" });

    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("published_at = case when");
    expect(query).toContain("else null end");
    expect(query).toContain("insert into admin_audit_logs");
    expect(sql.mock.calls[0]).toContain("marketplace_review.rejected");
    expect(sql.mock.calls[0]).toContain("Fails moderation");
  });

  it("keeps reputation limited to approved verified Marketplace reviews", () => {
    const migration = readFileSync("db/migrations/20260822_0063_marketplace_service_jobs_verified_reviews.sql", "utf8");
    expect(migration).toContain("website_reviews_marketplace_job_verified_unique_idx");
    expect(migration).toContain("review.is_verified = true");
    expect(migration).toContain("review.status = 'approved'");
    expect(migration).toContain("count(job.id) filter (where job.status = 'completed')");
    expect(migration).toContain("references marketplace_service_jobs(id) on delete cascade");
    expect(migration).toContain("add column if not exists locale text not null default 'sv'");
  });

  it("prevents a second winner/job generation and terminal reopening in the database", () => {
    const migration63 = readFileSync("db/migrations/20260822_0063_marketplace_service_jobs_verified_reviews.sql", "utf8");
    const migration64 = readFileSync("db/migrations/20260822_0064_marketplace_rematch_requests.sql", "utf8");
    expect(migration63).toContain("marketplace_service_jobs_quote_unique unique (quote_request_id)");
    expect(migration63).toContain("marketplace_service_job_invalid_transition");
    expect(migration63).toContain("new.workspace_id is not null and offer_workspace_id is distinct from new.workspace_id");
    expect(migration64).toContain("source_quote_request_id <> rematch_quote_request_id");
    expect(migration64).toContain("marketplace_service_job_rematch_already_requested");
    expect(migration64).toContain("marketplace_workspace_service_jobs");
    expect(migration64).toContain("coalesce(job.workspace_id, profile.claimed_workspace_id)");
    expect(migration64).toContain("coalesce(reputation_workspace.workspace_id, profile.claimed_workspace_id)");
  });
});
