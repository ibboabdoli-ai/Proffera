import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DIRECTORY_PILOT_LOCATIONS } from "@/lib/company-directory-policy";
import { applyCanonicalProfferaMigrations } from "../../../tests/helpers/postgres-canonical-schema";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { getDirectoryGuestLeadMatch } from "./directory-guest-single";

function sqlResponses(...responses: unknown[][]) {
  let index = 0;
  return vi.fn(async () => responses[index++] ?? []);
}

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

function docker(args: string[]) {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

function postgresSql(client: Client) {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0] ?? "";
    for (let index = 0; index < values.length; index += 1) {
      query += `$${index + 1}${strings[index + 1] ?? ""}`;
    }
    const result = await client.query(query, values);
    return result.rows as Record<string, unknown>[];
  };
}

const leadRow = {
  id: "11111111-1111-4111-8111-111111111111",
  reference_id: "QR-READY",
  category: "VVS",
  service_type: "VVS / Rörmokare",
  city: "Södertälje",
  postal_code: "151 46",
  description: "Läckande rör",
  status: "submitted",
  customer_latitude: null,
  customer_longitude: null,
  created_at: "2026-08-23T00:00:00.000Z",
};

const workplace = {
  visitingAddress: {
    addressLine: "ERIKSHÄLLSGATAN 40",
    postalCode: "151 46",
    city: "SÖDERTÄLJE",
  },
  municipality: "SÖDERTÄLJE",
};

const candidateRow = {
  profile_id: "22222222-2222-4222-8222-222222222222",
  public_slug: "ror-ab",
  display_name: "Rör AB",
  city: "Södertälje",
  municipality: "Södertälje",
  category_slug: "vvs",
  quality_score: 95,
  publication_status: "published",
  is_active: true,
  privacy_blocked: false,
  organization_kind: "juridical_person",
  claimed_workspace_id: null,
  advertising_blocked: false,
  service_slug: "vvs",
  service_name: "VVS / Rörmokare",
  service_category: "VVS",
  latitude: 59.1955,
  longitude: 17.6253,
  geocode_source: "lantmateriet_belagenhetsadress_v4_2",
  geocode_precision: "address",
  geocode_confidence: 100,
  geocoded_at: "2026-08-23T00:00:00.000Z",
  location_is_public: true,
  service_area_radius_km: 25,
  recipient_email: "offert@rorfirma.se",
  scb_phone: "+46 70 123 45 67",
  scb_workplaces: [workplace],
  scb_conflicts: [],
  has_current_authority: true,
};

describe("single-request Marketplace readiness gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a readiness-approved candidate but keeps missing customer geometry as locality fallback", async () => {
    const sql = sqlResponses([leadRow], [], [candidateRow]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toHaveLength(1);
    expect(result.match?.candidates[0]?.recipientEmail).toBe("offert@rorfirma.se");
    expect(result.match?.candidates[0]?.coverageState).toBe("locality_fallback");
  });

  it("propagates verified provider evidence into confirmed_inside when customer geometry is usable", async () => {
    const sql = sqlResponses([{
      ...leadRow,
      customer_latitude: 59.1955,
      customer_longitude: 17.6253,
    }], [], [candidateRow]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates[0]?.coverageState).toBe("confirmed_inside");
    expect(result.match?.candidates[0]?.serviceAreaConfirmed).toBe(true);
  });

  it("blocks a candidate with SCB reklamspärr from automatic outreach readiness", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      advertising_blocked: true,
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
  });

  it("blocks automatic outreach readiness when reklamspärr status is unknown", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      advertising_blocked: null,
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
  });

  it.each([
    ["stale SCB evidence"],
    ["a snapshot-invalid SCB comparison"],
  ])("fails closed after retrieval when current authority is not proven because of %s", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      has_current_authority: false,
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
    const candidateCall = (sql.mock.calls as unknown[][])[2] ?? [];
    const candidateQuery = String(candidateCall[0]);
    expect(candidateQuery).toContain("facts.last_synced_at >= profile.last_synced_at");
    expect(candidateQuery).toContain("scb.last_synced_at >= now() - interval '7 days'");
    expect(candidateQuery).toContain("{comparisonSnapshot,profileUpdatedToken}");
    expect(candidateQuery).toContain("{comparisonSnapshot,officialFactsLastSyncedToken}");
    expect(candidateQuery).toContain("jsonb_array_length(scb.workplaces) = 1");
    expect(candidateQuery).toContain("where has_current_authority = true");
    expect(candidateQuery.indexOf("where has_current_authority = true"))
      .toBeLessThan(candidateQuery.indexOf("limit 500"));
    expect(candidateCall.slice(1)).toContain(DIRECTORY_PILOT_LOCATIONS.join(","));
  });

  it("rejects arbitrary finite coordinates without verified Lantmäteriet provenance", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      geocode_source: "manual",
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
  });

  it("rejects ambiguous multiple SCB workplaces", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      scb_workplaces: [
        workplace,
        {
          visitingAddress: {
            addressLine: "RINGVÄGEN 80",
            postalCode: "118 60",
            city: "STOCKHOLM",
          },
          municipality: "STOCKHOLM",
        },
      ],
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
  });

  it("does not return a public-mailbox candidate to automatic outreach readiness", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      recipient_email: "rorfirma@gmail.com",
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
  });
});

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "single-request Marketplace authority filtering in PostgreSQL",
  () => {
    let containerName = "";
    let connectionString = "";
    let client: Client | null = null;

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
      containerName = `proffera-directory-guest-readiness-${process.pid}-${Date.now()}`;
      docker([
        "run", "--rm", "-d", "--name", containerName,
        "-e", "POSTGRES_PASSWORD=postgres",
        "-e", "POSTGRES_USER=postgres",
        "-e", "POSTGRES_DB=proffera_test",
        "-p", "127.0.0.1::5432",
        "postgis/postgis:16-3.5-alpine",
      ]);
      const portLine = docker(["port", containerName, "5432/tcp"]).split(/\r?\n/)[0] ?? "";
      const port = portLine.match(/:(\d+)$/)?.[1];
      if (!port) throw new Error(`Could not resolve PostgreSQL test port from: ${portLine}`);
      connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/proffera_test`;
      await waitForPostgres();
      client = new Client({ connectionString });
      await client.connect();

      await applyCanonicalProfferaMigrations(client);
    }, 120_000);

    beforeEach(async () => {
      vi.clearAllMocks();
      if (!client) throw new Error("PostgreSQL test client is not initialized");

      await client.query(`
        truncate table marketplace_quote_offers,
          marketplace_quote_invitations,
          company_directory_service_areas,
          company_directory_scb_enrichment,
          company_directory_official_facts,
          company_directory_business_locations,
          company_directory_profile_services,
          company_directory_profiles,
          quote_requests
        restart identity cascade;
      `);

      await client.query(`
        insert into quote_requests (
          id, reference_id, category, service_type, city, postal_code,
          description, preferred_date, contact_name, contact_email, contact_phone,
          consent_accepted, status, customer_latitude, customer_longitude, created_at
        ) values (
          $1::uuid, 'QR-READY', 'VVS', 'VVS / Rörmokare', 'Södertälje', '151 46',
          'Läckande rör', 'Så snart som möjligt', 'Ada Kund', 'ada@example.test', '0701234567',
          true, 'submitted', null, null, now()
        )
      `, [leadRow.id]);

      await client.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          public_slug, city, municipality, category_slug, quality_score,
          publication_status, is_active, privacy_blocked, auto_public_eligible,
          claimed_workspace_id, last_synced_at, updated_at, published_at
        ) values (
          $1::uuid, '5560000000', 'juridical_person', 'Rör AB', 'Rör AB',
          'ror-ab', 'Södertälje', 'Södertälje', 'vvs', 95,
          'ready', true, false, true,
          null, now() - interval '2 hours', now() - interval '2 hours', null
        )
      `, [candidateRow.profile_id]);

      await client.query(`
        insert into company_directory_profile_services (
          profile_id, service_slug, source_type, confidence, is_primary, is_active, public_visible, confirmed_at
        ) values ($1::uuid, 'vvs', 'admin', 100, true, true, true, now())
        on conflict (profile_id, service_slug) do update set
          source_type = excluded.source_type,
          confidence = excluded.confidence,
          is_primary = excluded.is_primary,
          is_active = excluded.is_active,
          public_visible = excluded.public_visible,
          confirmed_at = excluded.confirmed_at
      `, [candidateRow.profile_id]);

      await client.query(`
        insert into company_directory_business_locations (
          profile_id, latitude, longitude, geocode_source, geocode_precision,
          geocode_confidence, geocoded_at, is_public
        ) values (
          $1::uuid, 59.1955, 17.6253, 'lantmateriet_belagenhetsadress_v4_2',
          'address', 100, now(), true
        )
      `, [candidateRow.profile_id]);

      await client.query(`
        insert into company_directory_official_facts (
          profile_id, advertising_blocked, source_payload_hash, last_synced_at,
          deregistration_date, ongoing_procedures
        ) values (
          $1::uuid, false, 'facts-hash', now() - interval '1 hour', null, '[]'::jsonb
        )
      `, [candidateRow.profile_id]);

      await client.query(`
        insert into company_directory_service_areas (
          profile_id, radius_km, public_visible, confirmed_at, service_slug
        ) values ($1::uuid, 25, true, now(), 'vvs')
      `, [candidateRow.profile_id]);

      await client.query(`
        insert into company_directory_scb_enrichment (
          profile_id, organization_number, email, phone, workplaces, conflicts, source_payload_hash,
          last_synced_at, provenance
        )
        select
          profile.id,
          profile.organization_number,
          'offert@rorfirma.se',
          '+46 70 123 45 67',
          jsonb_build_array(jsonb_build_object(
            'visitingAddress', jsonb_build_object(
              'addressLine', 'ERIKSHÄLLSGATAN 40',
              'postalCode', '151 46',
              'city', 'SÖDERTÄLJE'
            ),
            'municipality', 'SÖDERTÄLJE'
          )),
          '[]'::jsonb,
          'scb-hash',
          now() - interval '30 minutes',
          jsonb_build_object(
            'comparisonSnapshot',
            jsonb_build_object(
              'profileUpdatedToken', profile.updated_at::text,
              'officialFactsLastSyncedToken', facts.last_synced_at::text
            )
          )
        from company_directory_profiles profile
        join company_directory_official_facts facts on facts.profile_id = profile.id
        where profile.id = $1::uuid
      `, [candidateRow.profile_id]);

      await client.query(`
        update company_directory_profiles
        set publication_status = 'published',
            published_at = now()
        where id = $1::uuid
      `, [candidateRow.profile_id]);

      mocks.getSql.mockReturnValue(postgresSql(client));
    });

    afterAll(async () => {
      await client?.end().catch(() => undefined);
      if (containerName) {
        try {
          docker(["stop", containerName]);
        } catch {
          // --rm may already have removed a failed container.
        }
      }
    }, 30_000);

    it("returns the candidate when SCB authority is fresh and snapshot-bound", async () => {
      const result = await getDirectoryGuestLeadMatch(leadRow.id);

      expect(result.ok).toBe(true);
      expect(result.match?.candidates).toHaveLength(1);
      expect(result.match?.candidates[0]?.profileId).toBe(candidateRow.profile_id);
    });

    it.each([
      [
        "stale SCB timestamp",
        "update company_directory_scb_enrichment set last_synced_at = now() - interval '8 days'",
      ],
      [
        "mismatched profileUpdatedToken",
        "update company_directory_scb_enrichment set provenance = jsonb_set(provenance, '{comparisonSnapshot,profileUpdatedToken}', to_jsonb('wrong-profile-token'::text))",
      ],
      [
        "mismatched officialFactsLastSyncedToken",
        "update company_directory_scb_enrichment set provenance = jsonb_set(provenance, '{comparisonSnapshot,officialFactsLastSyncedToken}', to_jsonb('wrong-facts-token'::text))",
      ],
    ])("filters %s before candidate ranking and limiting", async (_label, mutation) => {
      if (!client) throw new Error("PostgreSQL test client is not initialized");
      await client.query(mutation);

      const result = await getDirectoryGuestLeadMatch(leadRow.id);

      expect(result.ok).toBe(true);
      expect(result.match?.candidates).toEqual([]);
    });
  },
);
