import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  verifyOfficialCompanyCandidate: vi.fn(),
  upsertCompanyDirectoryCandidate: vi.fn(),
  enrichCompanyDirectoryOfficialFactsForProfile: vi.fn(),
  autoPublishCompanyDirectoryProfileIfSafe: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-source", () => ({
  verifyOfficialCompanyCandidate: mocks.verifyOfficialCompanyCandidate,
}));
vi.mock("@/lib/company-directory-engine", () => ({
  upsertCompanyDirectoryCandidate: mocks.upsertCompanyDirectoryCandidate,
}));
vi.mock("@/lib/company-directory-official-facts", () => ({
  enrichCompanyDirectoryOfficialFactsForProfile: mocks.enrichCompanyDirectoryOfficialFactsForProfile,
}));
vi.mock("@/lib/company-directory-publication", () => ({
  autoPublishCompanyDirectoryProfileIfSafe: mocks.autoPublishCompanyDirectoryProfileIfSafe,
}));
vi.mock("@/lib/company-directory-policy", () => ({ normalizeSniCode: (value: string) => value }));

import { BolagsverketOrganizationNotFoundError } from "../src/lib/company-directory-official-facts-errors";
import { processCompanyDirectoryDiscoveryQueue } from "../src/lib/company-directory-discovery-queue";

type SqlCall = { query: string; values: unknown[] };
let calls: SqlCall[];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE", "https://api.bolagsverket.se/organisationer");
  vi.stubEnv("COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN", "test-only");
  calls = [];

  mocks.getSql.mockReturnValue(vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("?").replace(/\s+/g, " ").trim();
    calls.push({ query, values });

    if (query.includes("where state = 'processing'")) return [];
    if (query.includes("with candidates as (")) {
      return [{
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        organization_number: "5561234567",
        primary_sni_code: "81210",
        provider: "bolagsverket_vardefulla_datamangder",
        source_fingerprint: "a".repeat(64),
        attempt_count: 1,
        lock_token: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }];
    }
    if (query.includes("update company_directory_discovery_queue") && query.includes("last_error = case")) {
      return [{ profile_id: null, source_unchanged: true }];
    }
    throw new Error("Unexpected SQL in queue backoff test: " + query);
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("automatic Directory discovery retry backoff", () => {
  it("defers deterministic missing-company responses for 24 hours", async () => {
    mocks.verifyOfficialCompanyCandidate.mockRejectedValue(
      new BolagsverketOrganizationNotFoundError("ORGANISATION_FINNS_EJ"),
    );
    const result = await processCompanyDirectoryDiscoveryQueue(1);
    expect(result).toMatchObject({ claimed: 1, processed: 0, errors: 1 });
    const retry = calls.find((call) => call.query.includes("last_error = case"));
    expect(retry).toBeDefined();
    expect(retry?.values).toContain(24 * 60);
    expect(retry?.values).toContain("pending_verify");
    expect(retry?.query).toContain("source_fingerprint =");
    expect(retry?.query).toContain("primary_sni_code =");
    expect(mocks.upsertCompanyDirectoryCandidate).not.toHaveBeenCalled();
  });

  it("keeps short retries for transient failures", async () => {
    mocks.verifyOfficialCompanyCandidate.mockRejectedValue(
      new Error("Official company verification timed out"),
    );
    const result = await processCompanyDirectoryDiscoveryQueue(1);
    expect(result).toMatchObject({ claimed: 1, processed: 0, errors: 1 });
    const retry = calls.find((call) => call.query.includes("last_error = case"));
    expect(retry).toBeDefined();
    expect(retry?.values).toContain(1);
    expect(retry?.values).not.toContain(24 * 60);
  });
});
