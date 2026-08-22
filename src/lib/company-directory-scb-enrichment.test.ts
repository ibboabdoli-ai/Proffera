import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  fetchScbCompanyRegistryEnrichment: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./db/server", () => ({ getSql: mocks.getSql }));
vi.mock("./company-directory-scb-provider", () => ({
  fetchScbCompanyRegistryEnrichment: mocks.fetchScbCompanyRegistryEnrichment,
}));

import type { ScbCompanyRegistryEnrichment } from "./company-directory-scb-provider";
import {
  detectScbCompanyDirectoryConflicts,
  enrichCompanyDirectoryScbForProfile,
  officialSniCodes,
} from "./company-directory-scb-enrichment";

const RUN_POSTGRES_INTEGRATION =
  process.env.GITHUB_ACTIONS === "true"
  || process.env.PROFFERA_POSTGRES_INTEGRATION === "1";

const RUNTIME_MIGRATION_PATHS = [
  "db/migrations/20260809_0037_company_profile_engine_foundation.sql",
  "db/migrations/20260809_0038_company_profile_engine_provenance.sql",
  "db/migrations/20260812_0044_company_directory_official_facts.sql",
  "db/migrations/20260819_0048_company_directory_scb_enrichment.sql",
] as const;

function scb(overrides: Partial<ScbCompanyRegistryEnrichment> = {}): ScbCompanyRegistryEnrichment {
  return {
    organizationNumber: "5563115707",
    legalName: "Exempel El AB",
    phone: null,
    email: null,
    postalAddress: {
      careOf: null,
      addressLine: null,
      postalCode: null,
      city: null,
    },
    municipality: null,
    sniCodes: ["43.210"],
    workplaces: [],
    source: "scb_foretagsregistret",
    provenance: {
      legalName: "scb_foretagsregistret",
      phone: "scb_foretagsregistret",
      email: "scb_foretagsregistret",
      postalAddress: "scb_foretagsregistret",
      municipality: "scb_foretagsregistret",
      sniCodes: "scb_foretagsregistret",
      workplaces: "scb_foretagsregistret",
    },
    ...overrides,
  };
}

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
    return result.rows;
  };
}

describe("SCB company directory enrichment guards", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
    mocks.fetchScbCompanyRegistryEnrichment.mockReset();
  });

  it("normalizes Bolagsverket SNI facts without duplicating codes", () => {
    expect(officialSniCodes([
      { code: "43.210", label: "Elinstallationer" },
      { kod: "43210" },
      "62.100",
    ])).toEqual(["43210", "62100"]);
  });

  it("does not flag equivalent legal names or overlapping SNI", () => {
    expect(detectScbCompanyDirectoryConflicts({
      bolagsverketLegalName: "Exempel El AB",
      bolagsverketSniCodes: [{ code: "43.210" }, { code: "71.120" }],
      scb: scb({
        legalName: "EXEMPEL EL AB",
        sniCodes: ["43.210", "95.220"],
      }),
    })).toEqual([]);
  });

  it("does not flag a long SCB legal name that is clearly truncated mid-name", () => {
    expect(detectScbCompanyDirectoryConflicts({
      bolagsverketLegalName: "Energi och VVS Service VVS-Shopen Svensson & Nyman Aktiebolag",
      bolagsverketSniCodes: [{ code: "43.221" }, { code: "43.229" }],
      scb: scb({
        legalName: "ENERGI OCH VVS SERVICE VVS-SHOPEN SVENSSON & NYM",
        sniCodes: ["43.221", "43.229"],
      }),
    })).toEqual([]);
  });

  it("still flags shorter prefix-like names as real mismatches", () => {
    expect(detectScbCompanyDirectoryConflicts({
      bolagsverketLegalName: "Exempel Elinstallationer Aktiebolag",
      bolagsverketSniCodes: [{ code: "43.210" }],
      scb: scb({ legalName: "Exempel El", sniCodes: ["43.210"] }),
    })).toEqual([
      {
        field: "legal_name",
        code: "legal_name_mismatch",
        bolagsverket: "Exempel Elinstallationer Aktiebolag",
        scb: "Exempel El",
      },
    ]);
  });

  it("preserves legal-name and SNI disagreements as explicit conflicts", () => {
    expect(detectScbCompanyDirectoryConflicts({
      bolagsverketLegalName: "Bolagsverket Namn AB",
      bolagsverketSniCodes: [{ code: "43.210" }],
      scb: scb({
        legalName: "SCB Namn AB",
        sniCodes: ["62.100"],
      }),
    })).toEqual([
      {
        field: "legal_name",
        code: "legal_name_mismatch",
        bolagsverket: "Bolagsverket Namn AB",
        scb: "SCB Namn AB",
      },
      {
        field: "sni_codes",
        code: "sni_no_overlap",
        bolagsverket: ["43210"],
        scb: ["62100"],
      },
    ]);
  });

  it("does not invent a conflict when one source lacks a comparable value", () => {
    expect(detectScbCompanyDirectoryConflicts({
      bolagsverketLegalName: "",
      bolagsverketSniCodes: [],
      scb: scb({ legalName: "SCB Namn AB", sniCodes: ["62.100"] }),
    })).toEqual([]);
  });

  it("persists the exact profile and Official Facts snapshot captured before the SCB request", async () => {
    const profileId = "11111111-1111-4111-8111-111111111111";
    const profileUpdatedToken = "2026-08-19 10:00:00.123456+00";
    const factsLastSyncedToken = "2026-08-19 09:59:00.654321+00";
    const sql = vi.fn()
      .mockResolvedValueOnce([{
        organization_number: "5563115707",
        organization_kind: "juridical_person",
        legal_name: "Exempel El AB",
        municipality: "",
        profile_updated_token: profileUpdatedToken,
        sni_codes: [{ code: "43.210" }],
        facts_last_synced_token: factsLastSyncedToken,
      }])
      .mockResolvedValueOnce([]);

    mocks.getSql.mockReturnValue(sql);
    mocks.fetchScbCompanyRegistryEnrichment.mockResolvedValue({
      status: "ok",
      data: scb(),
    });

    await expect(enrichCompanyDirectoryScbForProfile(profileId)).resolves.toEqual({
      status: "saved",
      saved: true,
      conflicts: [],
    });

    expect(mocks.fetchScbCompanyRegistryEnrichment).toHaveBeenCalledWith("5563115707", undefined);
    expect(sql).toHaveBeenCalledTimes(2);

    const provenanceValue = sql.mock.calls[1]?.[10];
    expect(JSON.parse(String(provenanceValue))).toMatchObject({
      comparisonSnapshot: {
        profileUpdatedToken,
        officialFactsLastSyncedToken: factsLastSyncedToken,
      },
    });
  });
});

(RUN_POSTGRES_INTEGRATION ? describe.sequential : describe.skip)(
  "SCB municipality projection PostgreSQL integration",
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
      containerName = `proffera-scb-municipality-${process.pid}-${Date.now()}`;
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

      // Migration 0037 references workspaces. The workspace table is an external
      // prerequisite; all Company Directory tables/constraints below come from
      // the committed migrations used in Production.
      await client.query("create table workspaces (id uuid primary key)");
      for (const migrationPath of RUNTIME_MIGRATION_PATHS) {
        const migration = readFileSync(join(process.cwd(), migrationPath), "utf8");
        await client.query(migration);
      }
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

    it("projects only a verified SCB municipality with provenance while preserving profile timestamps", async () => {
      const blankProfile = "11111111-1111-4111-8111-111111111111";
      const existingProfile = "22222222-2222-4222-8222-222222222222";
      const blankScbProfile = "33333333-3333-4333-8333-333333333333";
      const profileUpdatedAt = "2026-08-21T20:00:00.000Z";
      const factsSyncedAt = "2026-08-21T19:59:00.000Z";

      await client!.query(`
        truncate table company_directory_field_sources, company_directory_scb_enrichment,
          company_directory_official_facts, company_directory_profiles cascade
      `);

      await client!.query(`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          public_slug, municipality, updated_at
        ) values
          (
            $1, '5563115707', 'juridical_person', 'Blank Municipality AB', 'Blank Municipality AB',
            'blank-municipality-ab', '', $4
          ),
          (
            $2, '5563115708', 'juridical_person', 'Existing Municipality AB', 'Existing Municipality AB',
            'existing-municipality-ab', 'Stockholm', $4
          ),
          (
            $3, '5563115709', 'juridical_person', 'No SCB Municipality AB', 'No SCB Municipality AB',
            'no-scb-municipality-ab', '', $4
          )
      `, [blankProfile, existingProfile, blankScbProfile, profileUpdatedAt]);

      await client!.query(`
        insert into company_directory_official_facts (profile_id, sni_codes, last_synced_at) values
          ($1, '[{"code":"43.210"}]'::jsonb, $4),
          ($2, '[{"code":"43.210"}]'::jsonb, $4),
          ($3, '[{"code":"43.210"}]'::jsonb, $4)
      `, [blankProfile, existingProfile, blankScbProfile, factsSyncedAt]);

      const before = await client!.query<{ id: string; updated_at: string }>(`
        select id::text, updated_at::text
        from company_directory_profiles
        order by id
      `);

      mocks.getSql.mockReset();
      mocks.fetchScbCompanyRegistryEnrichment.mockReset();
      mocks.getSql.mockReturnValue(postgresSql(client!));
      mocks.fetchScbCompanyRegistryEnrichment.mockImplementation(async (organizationNumber: string) => {
        if (organizationNumber === "5563115707") {
          return {
            status: "ok",
            data: scb({
              organizationNumber,
              legalName: "Blank Municipality AB",
              municipality: "Södertälje",
            }),
          };
        }
        if (organizationNumber === "5563115708") {
          return {
            status: "ok",
            data: scb({
              organizationNumber,
              legalName: "Existing Municipality AB",
              municipality: "Södertälje",
            }),
          };
        }
        return {
          status: "ok",
          data: scb({
            organizationNumber,
            legalName: "No SCB Municipality AB",
            municipality: null,
          }),
        };
      });

      await expect(enrichCompanyDirectoryScbForProfile(blankProfile)).resolves.toEqual({
        status: "saved",
        saved: true,
        conflicts: [],
      });
      await expect(enrichCompanyDirectoryScbForProfile(existingProfile)).resolves.toEqual({
        status: "saved",
        saved: true,
        conflicts: [],
      });
      await expect(enrichCompanyDirectoryScbForProfile(blankScbProfile)).resolves.toEqual({
        status: "saved",
        saved: true,
        conflicts: [],
      });

      const profiles = await client!.query<{
        id: string;
        municipality: string;
        updated_at: string;
      }>(`
        select id::text, municipality, updated_at::text
        from company_directory_profiles
        order by id
      `);
      expect(profiles.rows[0]).toMatchObject({
        id: blankProfile,
        municipality: "Södertälje",
        updated_at: before.rows[0]?.updated_at,
      });
      expect(profiles.rows[1]).toMatchObject({
        id: existingProfile,
        municipality: "Stockholm",
        updated_at: before.rows[1]?.updated_at,
      });
      expect(profiles.rows[2]).toMatchObject({
        id: blankScbProfile,
        municipality: "",
        updated_at: before.rows[2]?.updated_at,
      });

      const provenance = await client!.query<{
        profile_id: string;
        field_name: string;
        source_name: string;
        source_record_id: string;
      }>(`
        select profile_id::text, field_name, source_name, source_record_id
        from company_directory_field_sources
        order by profile_id
      `);
      expect(provenance.rows).toEqual([{
        profile_id: blankProfile,
        field_name: "municipality",
        source_name: "scb_foretagsregistret",
        source_record_id: "5563115707",
      }]);

      const enrichmentCount = await client!.query<{ count: number }>(`
        select count(*)::int as count from company_directory_scb_enrichment
      `);
      expect(enrichmentCount.rows[0]?.count).toBe(3);
    }, 30_000);
  },
);
