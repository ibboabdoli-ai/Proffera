import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  assessConfidence: vi.fn(),
  enrichScb: vi.fn(),
  createTransport: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  assessCompanyDirectoryCategoryConfidence: mocks.assessConfidence,
}));
vi.mock("@/lib/company-directory-scb-enrichment", () => ({
  enrichCompanyDirectoryScbForProfile: mocks.enrichScb,
}));
vi.mock("@/lib/company-directory-scb-transport", () => ({
  createScbCompanyRegistryTransportFromEnv: mocks.createTransport,
}));

import { enrichReadyCompanyDirectoryScbBatch } from "@/lib/company-directory-ready-scb-enrichment";

const transport = {
  fetchCompany: vi.fn(),
  fetchWorkplaces: vi.fn(),
};

function candidates(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    category_slug: "elektriker",
    primary_sni_code: "43.210",
    legal_name: `Test El ${index + 1} AB`,
    display_name: `Test El ${index + 1} AB`,
    activity_description: "Elinstallation och service",
    registered_names: [{ name: `Test El ${index + 1} AB`, typeCode: "FORETAGSNAMN" }],
    sni_codes: [{ code: "43210", label: "Elinstallationer" }],
  }));
}

function enablePilot() {
  vi.stubEnv("COMPANY_DIRECTORY_READY_SCB_ENRICHMENT_ENABLED", "true");
  vi.stubEnv("COMPANY_DIRECTORY_AUTO_PUBLISH", "true");
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.createTransport.mockReturnValue(transport);
  mocks.assessConfidence.mockReturnValue({ officialFactsReady: true, score: 100 });
  mocks.enrichScb.mockResolvedValue({ status: "saved", saved: true, conflicts: [] });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("controlled Ready SCB enrichment", () => {
  it("is disabled by default with no DB access and no SCB traffic", async () => {
    vi.stubEnv("COMPANY_DIRECTORY_READY_SCB_ENRICHMENT_ENABLED", "");
    vi.stubEnv("COMPANY_DIRECTORY_AUTO_PUBLISH", "true");

    await expect(enrichReadyCompanyDirectoryScbBatch()).resolves.toMatchObject({
      skipped: true,
      reason: "pilot_disabled",
      attempted: 0,
    });
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(mocks.enrichScb).not.toHaveBeenCalled();
  });

  it("does not request SCB when automatic publication is disabled", async () => {
    vi.stubEnv("COMPANY_DIRECTORY_READY_SCB_ENRICHMENT_ENABLED", "true");
    vi.stubEnv("COMPANY_DIRECTORY_AUTO_PUBLISH", "false");

    await expect(enrichReadyCompanyDirectoryScbBatch()).resolves.toMatchObject({
      skipped: true,
      reason: "auto_publication_disabled",
    });
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("scans a bounded Ready-only, fail-closed SQL query and enriches two of five synthetic profiles", async () => {
    enablePilot();
    const sql = vi.fn(async () => candidates(5));
    mocks.getSql.mockReturnValue(sql);

    const result = await enrichReadyCompanyDirectoryScbBatch();

    expect(result).toMatchObject({
      skipped: false,
      scanned: 5,
      attempted: 2,
      saved: 2,
      errors: 0,
    });
    expect(mocks.enrichScb).toHaveBeenCalledTimes(2);
    expect(mocks.enrichScb).toHaveBeenNthCalledWith(
      1, candidates(5)[0].id, transport, { allowWhenDisabledWithExplicitTransport: true },
    );
    expect(mocks.enrichScb).toHaveBeenNthCalledWith(
      2, candidates(5)[1].id, transport, { allowWhenDisabledWithExplicitTransport: true },
    );

    const query = Array.from(sql.mock.calls[0][0] as TemplateStringsArray).join("?");
    expect(query).toContain("profile.publication_status = 'ready'");
    expect(query).toContain("profile.organization_kind = 'juridical_person'");
    expect(query).toContain("profile.privacy_blocked = false");
    expect(query).toContain("profile.claimed_workspace_id is null");
    expect(query).toContain("facts.last_synced_at >= profile.last_synced_at");
    expect(query).toContain("facts.deregistration_date is null");
    expect(query).toContain("facts.advertising_blocked, false");
    expect(query).toContain("jsonb_array_length(facts.ongoing_procedures) = 0");
    expect(query).toContain("scb.profile_id is null");
    expect(query).toContain("queue.state = 'failed'");
    expect(query).toContain("limit ?");
    expect(query).toContain("md5(profile.organization_number");
    expect(query).not.toContain("update company_directory_profiles");
    expect(query).not.toContain("publication_status = 'published'");
  });

  it("never enriches more than three profiles, even if the caller asks for 100", async () => {
    enablePilot();
    mocks.getSql.mockReturnValue(vi.fn(async () => candidates(25)));

    const result = await enrichReadyCompanyDirectoryScbBatch({ limit: 100 });

    expect(result.attempted).toBe(3);
    expect(mocks.enrichScb).toHaveBeenCalledTimes(3);
  });

  it("skips candidates without independently corroborated category confidence", async () => {
    enablePilot();
    mocks.getSql.mockReturnValue(vi.fn(async () => candidates(5)));
    mocks.assessConfidence.mockReturnValue({ officialFactsReady: false, score: 90 });

    const result = await enrichReadyCompanyDirectoryScbBatch({ limit: 3 });

    expect(result).toMatchObject({ attempted: 0, saved: 0, deferred: 5 });
    expect(mocks.enrichScb).not.toHaveBeenCalled();
  });

  it("continues safely after one upstream SCB failure without auto-publishing anything", async () => {
    enablePilot();
    mocks.getSql.mockReturnValue(vi.fn(async () => candidates(5)));
    mocks.enrichScb
      .mockRejectedValueOnce(new Error("SCB simulated timeout"))
      .mockResolvedValue({ status: "saved", saved: true, conflicts: [] });

    const result = await enrichReadyCompanyDirectoryScbBatch();

    expect(result).toMatchObject({ attempted: 2, saved: 1, errors: 1 });
    expect(result.errorSummary).toContain("SCB simulated timeout");
    expect(mocks.enrichScb).toHaveBeenCalledTimes(2);
  });

  it("honors the cron deadline and never starts a request without headroom", async () => {
    enablePilot();
    mocks.getSql.mockReturnValue(vi.fn(async () => candidates(5)));

    const result = await enrichReadyCompanyDirectoryScbBatch({
      deadlineAt: Date.now() + 1000,
    });

    expect(result.attempted).toBe(0);
    expect(mocks.enrichScb).not.toHaveBeenCalled();
  });
});
