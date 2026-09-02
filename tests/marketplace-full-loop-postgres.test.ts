import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  marketplaceGuestInvitationEmailConfigured: vi.fn(() => true),
  sendMarketplaceGuestInvitationEmail: vi.fn(),
  sendMarketplaceCustomerComparisonEmail: vi.fn(),
  sendVerifiedReviewInvitationEmail: vi.fn(),
  getDirectoryGuestLeadMatch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  marketplaceGuestInvitationEmailConfigured: mocks.marketplaceGuestInvitationEmailConfigured,
  sendMarketplaceGuestInvitationEmail: mocks.sendMarketplaceGuestInvitationEmail,
}));
vi.mock("@/features/email/marketplace-customer-comparison-email", () => ({
  sendMarketplaceCustomerComparisonEmail: mocks.sendMarketplaceCustomerComparisonEmail,
}));
vi.mock("@/features/email/review-invitation-email", () => ({
  sendVerifiedReviewInvitationEmail: mocks.sendVerifiedReviewInvitationEmail,
}));
vi.mock("@/features/matching/directory-guest-single", () => ({
  getDirectoryGuestLeadMatch: mocks.getDirectoryGuestLeadMatch,
}));

import { storeQuoteRequest } from "@/features/quote-request/persistence";
import {
  getMarketplaceCustomerComparison,
  notifyMarketplaceCustomerOfferAvailableFromGuestToken,
  selectMarketplaceCustomerOffer,
} from "@/lib/marketplace-customer-comparison";
import {
  getMarketplaceGuestQuoteView,
  submitMarketplaceGuestQuote,
} from "@/lib/marketplace-guest-quote";
import { processMarketplaceAutoWorker } from "@/lib/marketplace-auto-worker";
import {
  getMarketplaceServiceJobForCustomerToken,
  getMarketplaceServiceJobForGuestToken,
  transitionMarketplaceServiceJobByGuestToken,
} from "@/lib/marketplace-service-jobs";
import {
  deliverMarketplaceServiceJobReviewInvitation,
  getMarketplaceVerifiedReviewPreviewByHash,
  submitMarketplaceVerifiedReviewByHash,
} from "@/lib/marketplace-verified-review";
import { hashVerifiedReviewToken } from "@/lib/verified-review-token";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const baseline = readFileSync(
  join(process.cwd(), "tests/fixtures/marketplace-guest-production-baseline.sql"),
  "utf8",
);

const migrationFiles = [
  "20260812_0044_company_directory_official_facts.sql",
  "20260820_0049_marketplace_guest_quotes.sql",
  "20260820_0050_marketplace_guest_dispatch_claim.sql",
  "20260820_0051_marketplace_guest_runtime_eligibility.sql",
  "20260821_0052_marketplace_guest_final_hardening.sql",
  "20260821_0054_marketplace_guest_status_validation.sql",
  "20260821_0056_quote_request_customer_location.sql",
  "20260822_0060_marketplace_customer_comparison.sql",
] as const;

const reviewBaseline = `
create table admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id text,
  action text not null,
  reason text not null default '',
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table website_review_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  booking_id uuid not null,
  customer_id uuid,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_review_invitations_status_check
    check (status in ('pending', 'used', 'revoked')),
  constraint website_review_invitations_booking_unique unique (workspace_id, booking_id)
);

create table website_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  reviewer_name text not null,
  rating integer not null,
  service text,
  area text,
  message text not null,
  status text not null default 'pending',
  review_invitation_id uuid references website_review_invitations(id) on delete set null,
  booking_id uuid,
  customer_id uuid,
  is_verified boolean not null default false,
  verified_at timestamptz,
  moderated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_reviews_rating_check check (rating between 1 and 5),
  constraint website_reviews_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint website_reviews_reviewer_name_check check (char_length(btrim(reviewer_name)) between 2 and 80),
  constraint website_reviews_message_check check (char_length(btrim(message)) between 10 and 1000)
);
`;

const serviceJobMigration = "20260822_0063_marketplace_service_jobs_verified_reviews.sql";

type SqlRows = Record<string, unknown>[];
type SqlQuery = Promise<SqlRows>;
type SqlTag = ((strings: TemplateStringsArray, ...values: unknown[]) => SqlQuery) & {
  transaction: (
    callback: (transactionSql: SqlTag) => SqlQuery[],
    options?: unknown,
  ) => Promise<SqlRows[]>;
};

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function createPgSql(client: Client): SqlTag {
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    const params: unknown[] = [];
    for (let index = 0; index < values.length; index += 1) {
      params.push(values[index]);
      text += `$${params.length}${strings[index + 1] ?? ""}`;
    }
    const result = await client.query(text, params);
    return result.rows as SqlRows;
  }) as SqlTag;

  sql.transaction = async (callback) => {
    await client.query("begin");
    try {
      const queries = callback(sql);
      const results = await Promise.all(queries);
      await client.query("commit");
      return results;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  };

  return sql;
}

async function applyMigration(client: Client, file: string) {
  const sql = readFileSync(join(process.cwd(), "db/migrations", file), "utf8");
  await client.query(sql);
}

function tokenFromUrl(rawUrl: string, marker: string) {
  const url = new URL(rawUrl);
  const index = url.pathname.indexOf(marker);
  if (index < 0) throw new Error(`Expected ${marker} in ${url.pathname}`);
  return decodeURIComponent(url.pathname.slice(index + marker.length).split("/")[0] ?? "");
}

if (RUN_POSTGRES_INTEGRATION) {
  describe.sequential("Marketplace full loop PostgreSQL proof", () => {
    let containerName = "";
    let connectionString = "";
    let client: Client;
    const baseUrl = "https://marketplace-integration.proffera.test";
    const profileId = "d47fbfa7-e462-4ff0-8cef-fd2386780214";
    const providerEmail = "offers@integration-firm.se";

    async function waitForPostgres() {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const probe = new Client({ connectionString });
        try {
          await probe.connect();
          await probe.query("select 1");
          await probe.end();
          return;
        } catch (error) {
          lastError = error;
          await probe.end().catch(() => undefined);
          await delay(500);
        }
      }
      throw lastError ?? new Error("PostgreSQL test container did not become ready");
    }

    beforeAll(async () => {
      containerName = `proffera-marketplace-loop-${process.pid}-${Date.now()}`;
      docker([
        "run", "--rm", "-d", "--name", containerName,
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=proffera_test",
        "-p", "127.0.0.1::5432",
        "postgres:16-alpine",
      ]);
      const portLine = docker(["port", containerName, "5432/tcp"]).split(/\r?\n/u)[0] ?? "";
      const port = portLine.match(/:(\d+)$/u)?.[1];
      if (!port) throw new Error(`Could not resolve PostgreSQL port from: ${portLine}`);
      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      client = new Client({ connectionString });
      await client.connect();
      await client.query(baseline);
      for (const file of migrationFiles) await applyMigration(client, file);
      await client.query(reviewBaseline);
      await applyMigration(client, serviceJobMigration);
      mocks.getSql.mockReturnValue(createPgSql(client));
    }, 120_000);

    beforeEach(async () => {
      vi.clearAllMocks();
      mocks.getSql.mockReturnValue(createPgSql(client));
      mocks.marketplaceGuestInvitationEmailConfigured.mockReturnValue(true);
      process.env.BREVO_API_KEY = "integration-brevo-key";
      process.env.LEAD_FROM_EMAIL = "Proffera <lead@proffera.se>";
      process.env.CUSTOMER_PORTAL_SECRET = "integration-customer-portal-secret";
      process.env.NEXT_PUBLIC_APP_URL = baseUrl;
      delete process.env.MARKETPLACE_AUTO_WORKER_NOT_BEFORE;

      await client.query(`
        truncate table website_reviews,
          website_review_invitations,
          marketplace_service_job_events,
          marketplace_service_jobs,
          marketplace_quote_customer_access,
          marketplace_quote_offers,
          marketplace_outreach_suppressions,
          marketplace_quote_invitations,
          company_directory_official_facts,
          admin_audit_logs,
          quote_requests,
          company_directory_profiles,
          workspaces cascade
      `);

      await client.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          is_active, category_slug, city, municipality, public_slug,
          publication_status, quality_score, privacy_blocked, auto_public_eligible
        ) values (
          $1, '5566778899', 'juridical_person', 'Integration Rör AB', 'Integration Rör AB',
          true, 'vvs', 'Södertälje', 'Södertälje', 'integration-ror-ab',
          'published', 95, false, true
        )
      `, [profileId]);
      await client.query(`
        insert into company_directory_official_facts (profile_id, advertising_blocked)
        values ($1, false)
      `, [profileId]);

      mocks.sendMarketplaceGuestInvitationEmail.mockResolvedValue({
        ok: true,
        providerMessageId: "guest-email-1",
      });
      mocks.sendMarketplaceCustomerComparisonEmail.mockResolvedValue({
        ok: true,
        providerMessageId: "customer-email-1",
      });
      mocks.sendVerifiedReviewInvitationEmail.mockResolvedValue({
        ok: true,
        providerId: "review-email-1",
      });
    });

    afterAll(async () => {
      delete process.env.BREVO_API_KEY;
      delete process.env.LEAD_FROM_EMAIL;
      delete process.env.CUSTOMER_PORTAL_SECRET;
      delete process.env.NEXT_PUBLIC_APP_URL;
      await client?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // --rm can remove a failed container first.
        }
      }
    }, 30_000);

    it("proves request -> matching -> invitation -> offer -> winner -> job -> completion -> verified review", async () => {
      const stored = await storeQuoteRequest({
        category: "vvs",
        serviceType: "Rörmokare",
        addressLine1: "",
        locationSource: "geolocation",
        latitude: 59.1955,
        longitude: 17.6253,
        city: "Södertälje",
        postalCode: "15100",
        description: "Integration request for a leaking kitchen pipe.",
        preferredDate: "2030-01-15",
        contactName: "Anna Integration",
        contactEmail: "anna.integration@customer.se",
        contactPhone: "0701234567",
        consentAccepted: true,
      }, undefined, "sv");
      expect(stored).toMatchObject({ ok: true, created: true });
      if (!stored.ok) throw new Error(stored.message);

      const request = await client.query<{
        id: string;
        reference_id: string;
        created_at: string;
      }>(`
        select id::text, reference_id, created_at::text
        from quote_requests
        where reference_id = $1
      `, [stored.referenceId]);
      const quoteRequestId = String(request.rows[0]?.id ?? "");
      expect(quoteRequestId).toMatch(/^[0-9a-f-]{36}$/u);

      mocks.getDirectoryGuestLeadMatch.mockResolvedValue({
        ok: true,
        match: {
          lead: {
            id: quoteRequestId,
            reference_id: stored.referenceId,
            category: "vvs",
            service_type: "Rörmokare",
            city: "Södertälje",
            postal_code: "15100",
            description: "Integration request for a leaking kitchen pipe.",
            status: "submitted",
            customer_latitude: 59.1955,
            customer_longitude: 17.6253,
            created_at: String(request.rows[0]?.created_at ?? new Date().toISOString()),
          },
          candidates: [{
            profileId,
            slug: "integration-ror-ab",
            companyName: "Integration Rör AB",
            city: "Södertälje",
            municipality: "Södertälje",
            serviceSlug: "rormokare",
            serviceName: "Rörmokare",
            serviceCategory: "VVS",
            qualityScore: 95,
            score: 92,
            reasons: ["publicerad företagsprofil", "rätt kategori", "tjänstmatch"],
            distanceKm: 2,
            serviceAreaRadiusKm: 25,
            serviceAreaConfirmed: true,
            recipientEmail: providerEmail,
            contactBasis: "official_business_register",
          }],
          offers: [],
          radiusKm: 10,
        },
      });

      const worker = await processMarketplaceAutoWorker({
        baseUrl,
        targetReferenceIds: [stored.referenceId],
        batchSize: 1,
        deadlineMs: 20_000,
      });
      expect(worker).toMatchObject({ ok: true, scanned: 1, attempted: 1, sent: 1, wave1Sent: 1 });
      expect(mocks.sendMarketplaceGuestInvitationEmail).toHaveBeenCalledTimes(1);

      const guestEmailInput = mocks.sendMarketplaceGuestInvitationEmail.mock.calls[0]?.[0] as { replyUrl?: string } | undefined;
      const guestToken = tokenFromUrl(String(guestEmailInput?.replyUrl ?? ""), "/offert/svara/");
      expect(guestToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);

      const guestView = await getMarketplaceGuestQuoteView(guestToken);
      expect(guestView).toMatchObject({
        quoteReferenceId: stored.referenceId,
        companyName: "Integration Rör AB",
        status: "viewed",
      });

      const guestOffer = await submitMarketplaceGuestQuote({
        token: guestToken,
        priceKind: "fixed",
        amountMinor: 125000,
        availableDate: "2030-01-15",
        companyNote: "Vi kan utföra arbetet på önskat datum.",
      });
      expect(guestOffer).toMatchObject({ ok: true });

      const notify = await notifyMarketplaceCustomerOfferAvailableFromGuestToken({
        guestToken,
        baseUrl,
      });
      expect(notify).toEqual({ ok: true, code: "sent" });
      expect(mocks.sendMarketplaceCustomerComparisonEmail).toHaveBeenCalledTimes(1);

      const comparisonEmailInput = mocks.sendMarketplaceCustomerComparisonEmail.mock.calls[0]?.[0] as { comparisonUrl?: string } | undefined;
      const customerToken = tokenFromUrl(String(comparisonEmailInput?.comparisonUrl ?? ""), "/offert/jamfor/");
      expect(customerToken).toMatch(/^[A-Za-z0-9_-]{43}$/u);

      const comparisonBeforeSelection = await getMarketplaceCustomerComparison(customerToken);
      expect(comparisonBeforeSelection).toMatchObject({
        quoteReferenceId: stored.referenceId,
        quoteStatus: "answered",
      });
      expect(comparisonBeforeSelection?.offers).toHaveLength(1);
      const offerId = String(comparisonBeforeSelection?.offers[0]?.id ?? "");
      expect(offerId).toMatch(/^[0-9a-f-]{36}$/u);

      const selected = await selectMarketplaceCustomerOffer(customerToken, offerId);
      expect(selected).toEqual({ ok: true, offerId });

      const providerJob = await getMarketplaceServiceJobForGuestToken(guestToken);
      const customerJob = await getMarketplaceServiceJobForCustomerToken(customerToken);
      expect(providerJob).toMatchObject({ status: "accepted", amountMinor: 125000 });
      expect(customerJob?.id).toBe(providerJob?.id);
      const serviceJobId = String(providerJob?.id ?? "");
      expect(serviceJobId).toMatch(/^[0-9a-f-]{36}$/u);

      const started = await transitionMarketplaceServiceJobByGuestToken({
        token: guestToken,
        nextStatus: "in_progress",
      });
      expect(started).toMatchObject({ ok: true, job: { status: "in_progress" } });

      const completed = await transitionMarketplaceServiceJobByGuestToken({
        token: guestToken,
        nextStatus: "completed",
        completionSummary: "Röret byttes och installationen provtrycktes utan läckage.",
      });
      expect(completed).toMatchObject({ ok: true, job: { status: "completed" } });

      const reviewInvitation = await deliverMarketplaceServiceJobReviewInvitation(serviceJobId);
      expect(reviewInvitation).toMatchObject({ ok: true });
      if (!reviewInvitation.ok || !("reviewUrl" in reviewInvitation)) {
        throw new Error("Verified review invitation was not delivered");
      }
      expect(mocks.sendVerifiedReviewInvitationEmail).toHaveBeenCalledTimes(1);
      const reviewToken = tokenFromUrl(reviewInvitation.reviewUrl, "/review/marketplace/");
      const reviewTokenHash = hashVerifiedReviewToken(reviewToken);

      const reviewPreview = await getMarketplaceVerifiedReviewPreviewByHash(reviewTokenHash);
      expect(reviewPreview).toMatchObject({
        state: "valid",
        companyName: "Integration Rör AB",
        bookingId: serviceJobId,
      });

      const review = await submitMarketplaceVerifiedReviewByHash(reviewTokenHash, {
        reviewerName: "Anna Integration",
        rating: 5,
        message: "Mycket bra arbete och tydlig kommunikation.",
        consent: true,
        website: "",
        formStartedAt: Date.now() - 10_000,
      });
      expect(review).toMatchObject({ ok: true });

      const repeatedReview = await submitMarketplaceVerifiedReviewByHash(reviewTokenHash, {
        reviewerName: "Anna Integration",
        rating: 5,
        message: "Mycket bra arbete och tydlig kommunikation.",
        consent: true,
        website: "",
        formStartedAt: Date.now() - 10_000,
      });
      expect(repeatedReview).toEqual({ ok: false, code: "used" });

      const terminal = await client.query<{
        request_status: string;
        offer_status: string;
        invitation_status: string;
        job_status: string;
        review_count: number;
        verified_review_count: number;
        review_invitation_status: string;
      }>(`
        select
          request.status as request_status,
          offer.status as offer_status,
          invitation.status as invitation_status,
          job.status as job_status,
          (select count(*)::int from website_reviews review where review.marketplace_service_job_id = job.id) as review_count,
          (select count(*)::int from website_reviews review where review.marketplace_service_job_id = job.id and review.is_verified = true) as verified_review_count,
          review_invitation.status as review_invitation_status
        from quote_requests request
        join marketplace_quote_offers offer on offer.quote_request_id = request.id and offer.status = 'selected'
        join marketplace_quote_invitations invitation on invitation.id = offer.invitation_id
        join marketplace_service_jobs job on job.quote_request_id = request.id
        join website_review_invitations review_invitation on review_invitation.marketplace_service_job_id = job.id
        where request.id = $1
      `, [quoteRequestId]);
      expect(terminal.rows[0]).toMatchObject({
        request_status: "booked",
        offer_status: "selected",
        invitation_status: "responded",
        job_status: "completed",
        review_count: 1,
        verified_review_count: 1,
        review_invitation_status: "used",
      });
    }, 60_000);
  });
} else {
  describe.skip("Marketplace full loop PostgreSQL proof", () => {
    it("requires Docker PostgreSQL integration opt-in", () => undefined);
  });
}
