import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const RUN_POSTGRES_INTEGRATION =
  process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPlatformAdmin: vi.fn(),
  hasWorkspaceFeatureAccessForWorkspace: vi.fn(),
  getPublicWorkspaceExperienceSettings: vi.fn(),
  headers: vi.fn(),
  resolvePublicBusinessUrlContext: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  hasWorkspaceFeatureAccessForWorkspace: mocks.hasWorkspaceFeatureAccessForWorkspace,
}));
vi.mock("@/lib/workspace-experience", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/workspace-experience")>();
  return {
    ...actual,
    getPublicWorkspaceExperienceSettings: mocks.getPublicWorkspaceExperienceSettings,
  };
});
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("not_found"); }) }));
vi.mock("@/components/public-business/public-contact-form", () => ({
  PublicBusinessContactForm: () => null,
}));
vi.mock("@/components/public-business/public-business-tracking", () => ({
  PublicBusinessTrackedLink: () => null,
  PublicBusinessViewEvent: () => null,
}));
vi.mock("@/lib/public-business-seo", () => ({
  resolvePublicBusinessUrlContext: mocks.resolvePublicBusinessUrlContext,
  buildPublicBusinessJsonLd: (business: { companyName: string }) => ({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.companyName,
  }),
  serializePublicBusinessJsonLd: (value: unknown) => JSON.stringify(value),
}));

import PublicBusinessPage, { generateMetadata } from "@/app/foretag/[workspace]/page";
import { approveSoleTraderDirectoryClaim } from "@/lib/company-directory-sole-trader-owner";
import { getPublicBusinessHub } from "@/lib/public-business-hub";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const CLAIM_ID = "33333333-3333-4333-8333-333333333333";
const WORKSPACE_SLUG = "synthetic-safe-service";
const BLOCKED_ACTIVITY_MARKER = "WA3_BLOCKED_ACTIVITY_MUST_NOT_PUBLISH_8F2B6A";
const OWNER_INTRO = "Owner-authored Workspace introduction";

const preHubMigrations = [
  "20260613_phase18_booking_crm.sql",
  "20260614_phase18_15_workspace_settings.sql",
  "20260614_phase18_16_workspace_services.sql",
  "20260616_0001_better_auth_core_schema.sql",
  "20260616_0002_proffera_workspace_schema.sql",
  "20260715_0005_public_booking_foundation.sql",
  "20260728_0016_workspace_staff.sql",
  "20260729_0019_website_reviews.sql",
  "20260730_0019a_website_gallery_items.sql",
  "20260801_0020_workspace_market_settings.sql",
  "20260802_0021_workspace_service_pricing.sql",
  "20260802_0022_workspace_quote_requests.sql",
  "20260802_0023_workspace_quote_offers.sql",
  "20260802_0025_workspace_service_jobs.sql",
  "20260803_0028_booking_email_verifications.sql",
] as const;

const postBootstrapMigrations = [
  "20260809_0036_public_business_hub.sql",
  "20260809_0037_company_profile_engine_foundation.sql",
  "20260809_0040_company_profile_claim_reservation.sql",
] as const;

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

async function applyMigration(client: Client, file: string) {
  const migration = readFileSync(join(process.cwd(), "db/migrations", file), "utf8");
  await client.query(migration);
}

async function createExternalBootstrapPrerequisites(client: Client) {
  // These two historical prerequisites are not created by the active
  // db/migrations chain. Keep only the minimum surface needed before canonical
  // migrations/application code take over the schema exercised by this proof.
  await client.query(`
    create table workspace_experience_settings (
      workspace_id uuid primary key references workspaces(id) on delete cascade
    );

    create table admin_audit_logs (
      id uuid primary key default gen_random_uuid(),
      admin_user_id text not null,
      workspace_id uuid,
      action text not null,
      reason text,
      previous_value jsonb,
      new_value jsonb,
      created_at timestamptz not null default now()
    );
  `);
}

function createPostgresSqlAdapter(client: Client) {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      query += `$${index + 1}${strings[index + 1] ?? ""}`;
    }
    const result = await client.query(query, values);
    return result.rows as Record<string, unknown>[];
  };
}

const publicExperience = {
  themeKey: "clean" as const,
  primaryColor: "#17452f",
  accentColor: "#d9b44a",
  appearance: "light" as const,
  defaultLanguage: "sv" as const,
  swedishEnabled: true,
  englishEnabled: true,
  heroEnabled: true,
  servicesEnabled: false,
  staffEnabled: false,
  reviewsEnabled: false,
  galleryEnabled: false,
  contactEnabled: false,
  faqEnabled: false,
  chatbotEnabled: false,
  logoUrl: "",
  heroImageUrl: "",
  heroVideoUrl: "",
  customDomain: "",
  customDomainStatus: "disconnected",
  themeContentOverrides: {},
};

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "sole-trader ownership publication privacy PostgreSQL integration",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client;

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
      containerName = `proffera-sole-trader-publication-privacy-${process.pid}-${Date.now()}`;
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
      if (!port) throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);

      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      client = new Client({ connectionString });
      await client.connect();

      for (const file of preHubMigrations) await applyMigration(client, file);
      await createExternalBootstrapPrerequisites(client);
      for (const file of postBootstrapMigrations) await applyMigration(client, file);
    }, 120_000);

    afterAll(async () => {
      await client?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // --rm can remove a failed container before cleanup.
        }
      }
    }, 30_000);

    beforeEach(async () => {
      for (const mock of Object.values(mocks)) mock.mockReset();
      mocks.getSql.mockReturnValue(createPostgresSqlAdapter(client));
      mocks.getPlatformAdmin.mockResolvedValue({ userId: "admin-1", role: "super_admin" });
      mocks.hasWorkspaceFeatureAccessForWorkspace.mockImplementation(async (_workspaceId: string, feature: string) => (
        feature === "website_builder"
      ));
      mocks.getPublicWorkspaceExperienceSettings.mockResolvedValue(publicExperience);
      mocks.headers.mockResolvedValue(new Headers({ host: "www.proffera.se" }));
      mocks.resolvePublicBusinessUrlContext.mockResolvedValue({
        customDomain: false,
        origin: "https://www.proffera.se",
        companyCanonical: `https://www.proffera.se/foretag/${WORKSPACE_SLUG}`,
        companyHref: `/foretag/${WORKSPACE_SLUG}`,
        serviceCanonical: (serviceSlug: string) => `https://www.proffera.se/foretag/${WORKSPACE_SLUG}/tjanster/${serviceSlug}`,
        serviceHref: (serviceSlug: string) => `/foretag/${WORKSPACE_SLUG}/tjanster/${serviceSlug}`,
      });

      await client.query(`
        truncate table admin_audit_logs, company_directory_claims, company_directory_profiles,
          workspace_experience_settings, workspaces, "user"
        restart identity cascade
      `);

      await client.query(`
        insert into "user" (id, name, email, "emailVerified")
        values ('claimant-1', 'Synthetic Claimant', 'claimant@example.test', true)
      `);
      await client.query(`
        insert into workspaces (
          id, slug, status, public_booking_slug, company_name, name,
          primary_city, contact_email, contact_phone
        ) values ($1::uuid, $2, 'active', '', 'Synthetic Safe Service', 'Synthetic Safe Service', 'Teststad', '', '')
      `, [WORKSPACE_ID, WORKSPACE_SLUG]);
      await client.query(`
        insert into workspace_memberships (id, workspace_id, user_id, role)
        values ($1::uuid, $2::uuid, 'claimant-1', 'owner')
      `, [MEMBERSHIP_ID, WORKSPACE_ID]);
      await client.query(`
        insert into workspace_experience_settings (workspace_id, business_intro)
        values ($1::uuid, '')
      `, [WORKSPACE_ID]);
      await client.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          public_slug, claimed_workspace_id, claim_reservation_id,
          publication_status, is_active, privacy_blocked, auto_public_eligible,
          official_source, activity_description
        ) values (
          $1::uuid, '9900000001', 'sole_trader', 'Synthetic Safe Service', 'Synthetic Safe Service',
          'synthetic-safe-service-directory', null, null,
          'blocked', true, true, false,
          'bolagsverket_vardefulla_datamangder:sole_trader_owner', $2
        )
      `, [PROFILE_ID, BLOCKED_ACTIVITY_MARKER]);
      await client.query(`
        insert into company_directory_claims (
          id, profile_id, claimant_user_id, requested_workspace_id,
          status, verification_method, verification_reference
        ) values ($1::uuid, $2::uuid, 'claimant-1', $3::uuid, 'pending', 'manual_review', '{}')
      `, [CLAIM_ID, PROFILE_ID, WORKSPACE_ID]);
    });

    it("approves ownership while keeping blocked Directory activity out of the real public loader, HTML, and metadata", async () => {
      await expect(approveSoleTraderDirectoryClaim({
        claimId: CLAIM_ID,
        reference: "Synthetic ownership verification",
      })).resolves.toEqual({ claimId: CLAIM_ID, workspaceId: WORKSPACE_ID });

      const profile = await client.query<{
        claimed_workspace_id: string | null;
        publication_status: string;
        privacy_blocked: boolean;
        auto_public_eligible: boolean;
        activity_description: string;
      }>(`
        select claimed_workspace_id::text, publication_status, privacy_blocked,
          auto_public_eligible, activity_description
        from company_directory_profiles
        where id = $1::uuid
      `, [PROFILE_ID]);
      expect(profile.rows[0]).toEqual({
        claimed_workspace_id: WORKSPACE_ID,
        publication_status: "blocked",
        privacy_blocked: true,
        auto_public_eligible: false,
        activity_description: BLOCKED_ACTIVITY_MARKER,
      });

      const claim = await client.query<{ status: string }>(`
        select status from company_directory_claims where id = $1::uuid
      `, [CLAIM_ID]);
      expect(claim.rows[0]?.status).toBe("claimed");

      const experience = await client.query<{ business_intro: string }>(`
        select business_intro from workspace_experience_settings where workspace_id = $1::uuid
      `, [WORKSPACE_ID]);
      expect(experience.rows[0]?.business_intro).toBe("");

      const hub = await getPublicBusinessHub(WORKSPACE_SLUG);
      expect(hub?.workspace.businessIntro).toBe("");
      expect(JSON.stringify(hub)).not.toContain(BLOCKED_ACTIVITY_MARKER);

      const props = {
        params: Promise.resolve({ workspace: WORKSPACE_SLUG }),
        searchParams: Promise.resolve({ lang: "sv" }),
      };
      const html = renderToStaticMarkup(await PublicBusinessPage(props));
      const metadata = await generateMetadata(props);

      expect(html).not.toContain(BLOCKED_ACTIVITY_MARKER);
      expect(JSON.stringify(metadata)).not.toContain(BLOCKED_ACTIVITY_MARKER);
      expect(html).toContain("Se våra tjänster, välj det som passar");
      expect(metadata.description).toContain("tjänster, bokning och kontakt via Proffera");
    }, 30_000);

    it("preserves user-authored public Workspace introduction through ownership approval", async () => {
      await client.query(`
        update workspace_experience_settings
        set business_intro = $2
        where workspace_id = $1::uuid
      `, [WORKSPACE_ID, OWNER_INTRO]);

      await approveSoleTraderDirectoryClaim({
        claimId: CLAIM_ID,
        reference: "Synthetic ownership verification",
      });

      const experience = await client.query<{ business_intro: string }>(`
        select business_intro from workspace_experience_settings where workspace_id = $1::uuid
      `, [WORKSPACE_ID]);
      expect(experience.rows[0]?.business_intro).toBe(OWNER_INTRO);

      const hub = await getPublicBusinessHub(WORKSPACE_SLUG);
      expect(hub?.workspace.businessIntro).toBe(OWNER_INTRO);

      const props = {
        params: Promise.resolve({ workspace: WORKSPACE_SLUG }),
        searchParams: Promise.resolve({ lang: "sv" }),
      };
      const html = renderToStaticMarkup(await PublicBusinessPage(props));
      const metadata = await generateMetadata(props);

      expect(html).toContain(OWNER_INTRO);
      expect(metadata.description).toBe(OWNER_INTRO);
      expect(html).not.toContain(BLOCKED_ACTIVITY_MARKER);
      expect(JSON.stringify(metadata)).not.toContain(BLOCKED_ACTIVITY_MARKER);
    }, 30_000);
  },
);
