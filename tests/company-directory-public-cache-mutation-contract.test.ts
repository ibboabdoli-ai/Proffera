import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  invalidateProjection: vi.fn(),
  invalidateByProfileId: vi.fn(),
  invalidateAll: vi.fn(),
  assessConfidence: vi.fn(),
  enrichScb: vi.fn(),
  policyBatch: vi.fn(),
  fullBatch: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-public-cache", () => ({
  invalidatePublicDirectoryPublicProjection: mocks.invalidateProjection,
  invalidatePublicDirectoryPublicProjectionByProfileId: mocks.invalidateByProfileId,
  invalidateAllPublicDirectoryPublicCaches: mocks.invalidateAll,
}));
vi.mock("@/lib/company-directory-category-confidence", () => ({
  COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION: "test-policy",
  assessCompanyDirectoryCategoryConfidence: mocks.assessConfidence,
}));
vi.mock("@/lib/company-directory-scb-enrichment", () => ({
  enrichCompanyDirectoryScbForProfile: mocks.enrichScb,
}));
vi.mock("@/lib/company-directory-category-policy-revalidation", () => ({
  revalidateCompanyDirectoryCategoryPolicyBatch: mocks.policyBatch,
}));
vi.mock("@/lib/company-directory-full-revalidation", () => ({
  revalidateAllCompanyDirectoryBatch: mocks.fullBatch,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assessConfidence.mockReturnValue({ officialFactsReady: true, score: 100 });
});

describe("public Directory safety mutation invalidation", () => {
  it("invalidates the affected profile immediately after successful publication", async () => {
    const profileId = "11111111-1111-4111-8111-111111111111";
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("from company_directory_profiles p") && query.includes("official_facts_fresh")) {
        return [{
          id: profileId,
          public_slug: "safe-company-ab",
          display_name: "Safe Company AB",
          legal_name: "Safe Company AB",
          category_slug: "vvs",
          primary_sni_code: "43.221",
          activity_description: "VVS",
          publication_status: "ready",
          is_active: true,
          privacy_blocked: false,
          auto_public_eligible: true,
          claimed_workspace_id: null,
          profile_updated_token: "profile-v1",
          registered_names: [],
          sni_codes: [],
          deregistration_date: null,
          advertising_blocked: false,
          ongoing_procedures: [],
          facts_last_synced_token: "facts-v1",
          facts_source_payload_hash: "facts-hash",
          scb_conflict_count: 0,
          official_facts_fresh: true,
          scb_snapshot_fresh: true,
        }];
      }
      if (query.includes("update company_directory_profiles p")) {
        return [{ public_slug: "safe-company-ab" }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const { publishCompanyDirectoryProfileIfSafe } = await import("@/lib/company-directory-publication");
    await expect(publishCompanyDirectoryProfileIfSafe(profileId)).resolves.toEqual({
      ok: true,
      code: "published",
      slug: "safe-company-ab",
    });

    expect(mocks.invalidateProjection).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateProjection).toHaveBeenCalledWith({
      slug: "safe-company-ab",
      profileId,
    });
  });

  it("invalidates the profile after an existing-workspace claim becomes owned", async () => {
    const profileId = "11111111-1111-4111-8111-111111111111";
    const sql = vi.fn(async () => [{ id: "33333333-3333-4333-8333-333333333333" }]);
    mocks.getSql.mockReturnValue(sql);

    const { finalizeCompanyDirectoryClaimIntoExistingWorkspace } = await import(
      "@/lib/company-directory-existing-workspace-claim"
    );

    await expect(finalizeCompanyDirectoryClaimIntoExistingWorkspace({
      claimId: "33333333-3333-4333-8333-333333333333",
      profileId,
      workspaceId: "22222222-2222-4222-8222-222222222222",
      claimantUserId: "user-1",
      adminUserId: "admin-1",
      adminReference: "verified",
      approvedEvidence: "evidence",
      activityDescription: "description",
    })).resolves.toMatchObject({
      claimId: "33333333-3333-4333-8333-333333333333",
      workspaceId: "22222222-2222-4222-8222-222222222222",
    });

    expect(mocks.invalidateByProfileId).toHaveBeenCalledWith(profileId);
  });

  it("globally expires public Directory caches when a batch safety sweep demotes profiles", async () => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.COMPANY_DIRECTORY_SYNC_ENABLED = "true";
    process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED = "true";

    mocks.policyBatch.mockResolvedValue({
      policyVersion: "test-policy",
      reason: undefined,
      selected: 1,
      evaluated: 1,
      kept: 0,
      movedToReview: 1,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      remaining: 0,
    });
    mocks.fullBatch.mockResolvedValue({
      skipped: false,
      selected: 1,
      refreshed: 1,
      kept: 0,
      movedToReview: 1,
      recoveredToReady: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      remaining: 0,
    });

    const { GET } = await import("@/app/api/cron/company-directory-revalidation/route");
    const response = await GET(new Request("https://example.test/api/cron/company-directory-revalidation", {
      headers: { authorization: "Bearer cron-secret" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.invalidateAll).toHaveBeenCalledTimes(2);
  });
});
