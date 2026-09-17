import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  invalidateProjection: vi.fn(),
  invalidateByProfileId: vi.fn(),
  invalidateAll: vi.fn(),
  assessConfidence: vi.fn(),
  enrichScb: vi.fn(),
  enrichOfficialFacts: vi.fn(),
  createScbTransport: vi.fn(),
  policyBatch: vi.fn(),
  fullBatch: vi.fn(),
  assessDirectoryCandidate: vi.fn(),
  buildDirectoryPublicSlug: vi.fn(),
  mapPrimarySni: vi.fn(),
  fetchDirectoryBatch: vi.fn(),
  verifyDirectoryCandidate: vi.fn(),
  provisionWorkspace: vi.fn(),
  createWorkspaceSlug: vi.fn(),
  getPlatformAdmin: vi.fn(),
  parseClaimEmailEvidence: vi.fn(),
  isClaimBusinessEmailVerified: vi.fn(),
  serializeClaimEmailEvidence: vi.fn(),
  validBusinessEmail: vi.fn(),
  businessEmailDomainKind: vi.fn(),
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
vi.mock("@/lib/company-directory-official-facts", () => ({
  enrichCompanyDirectoryOfficialFactsForProfile: mocks.enrichOfficialFacts,
}));
vi.mock("@/lib/company-directory-scb-transport", () => ({
  createScbCompanyRegistryTransportFromEnv: mocks.createScbTransport,
}));
vi.mock("@/lib/company-directory-category-policy-revalidation", () => ({
  revalidateCompanyDirectoryCategoryPolicyBatch: mocks.policyBatch,
}));
vi.mock("@/lib/company-directory-full-revalidation", () => ({
  revalidateAllCompanyDirectoryBatch: mocks.fullBatch,
}));
vi.mock("@/lib/company-directory-policy", () => ({
  assessDirectoryCandidate: mocks.assessDirectoryCandidate,
  buildDirectoryPublicSlug: mocks.buildDirectoryPublicSlug,
}));
vi.mock("@/lib/company-directory-service-taxonomy", () => ({
  mapPrimarySniToDirectorySearchService: mocks.mapPrimarySni,
}));
vi.mock("@/lib/company-directory-source", () => ({
  fetchOfficialCompanyDirectoryBatch: mocks.fetchDirectoryBatch,
  verifyOfficialCompanyCandidate: mocks.verifyDirectoryCandidate,
}));
vi.mock("@/features/company/workspace-provisioning", () => ({
  provisionWorkspace: mocks.provisionWorkspace,
  createWorkspaceSlug: mocks.createWorkspaceSlug,
}));
vi.mock("@/lib/platform-admin", () => ({
  getPlatformAdmin: mocks.getPlatformAdmin,
}));
vi.mock("@/lib/company-directory-claim-email", () => ({
  parseClaimEmailEvidence: mocks.parseClaimEmailEvidence,
  isClaimBusinessEmailVerified: mocks.isClaimBusinessEmailVerified,
  serializeClaimEmailEvidence: mocks.serializeClaimEmailEvidence,
  validBusinessEmail: mocks.validBusinessEmail,
  businessEmailDomainKind: mocks.businessEmailDomainKind,
}));

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const CLAIM_ID = "33333333-3333-4333-8333-333333333333";
const INVITATION_ID = "44444444-4444-4444-8444-444444444444";
const RUN_ID = "55555555-5555-4555-8555-555555555555";

function publicationSql(slug = "safe-company-ab") {
  return vi.fn(async (strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    if (query.includes("from company_directory_profiles p") && query.includes("official_facts_fresh")) {
      return [{
        id: PROFILE_ID,
        public_slug: slug,
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
      return [{ public_slug: slug }];
    }
    return [];
  });
}

function cronRequest() {
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("COMPANY_DIRECTORY_SYNC_ENABLED", "true");
  vi.stubEnv("COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED", "true");
  return new Request("https://example.test/api/cron/company-directory-revalidation", {
    headers: { authorization: "Bearer cron-secret" },
  });
}

function adminClaimSql() {
  const queries: string[] = [];
  const sql = vi.fn(async (strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    queries.push(query);
    if (query.includes("from company_directory_claims claim") && query.includes('join "user" u')) {
      return [{
        id: CLAIM_ID,
        status: "pending",
        verification_method: "email_domain",
        verification_reference: "verified-evidence",
        requested_workspace_id: null,
        profile_id: PROFILE_ID,
        display_name: "Safe Company AB",
        city: "Stockholm",
        activity_description: "VVS",
        claimed_workspace_id: null,
        claim_reservation_id: null,
        claim_reserved_at: null,
        claimant_user_id: "user-1",
        claimant_email: "owner@safe.example",
        claimant_email_verified: true,
      }];
    }
    if (query.includes("update company_directory_profiles profile") && query.includes("claim_reservation_id =")) {
      return [{ id: PROFILE_ID }];
    }
    if (query.includes("update company_directory_claims") && query.includes("status = 'verified'")) {
      return [{ id: CLAIM_ID }];
    }
    if (query.includes("with locked_pair as") && query.includes("returning claim.profile_id::text")) {
      return [{ profile_id: PROFILE_ID }];
    }
    return [];
  }) as ReturnType<typeof vi.fn> & { transaction: ReturnType<typeof vi.fn> };

  sql.transaction = vi.fn(async (callback: (tx: ReturnType<typeof vi.fn>) => Array<Promise<unknown>>) => {
    const tx = vi.fn(async () => []);
    return Promise.all(callback(tx));
  });

  return { sql, queries };
}

function marketplaceClaimSql() {
  const queries: string[] = [];
  const sql = vi.fn(async (strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    queries.push(query);
    if (query.includes("left join lateral") && query.includes("marketplace_quote_invitations invited")) {
      return [{
        claim_id: CLAIM_ID,
        claim_status: "pending",
        verification_method: "email_domain",
        verification_reference: "verified-evidence",
        requested_workspace_id: null,
        profile_id: PROFILE_ID,
        display_name: "Safe Company AB",
        city: "Stockholm",
        activity_description: "VVS",
        publication_status: "published",
        is_active: true,
        privacy_blocked: false,
        auto_public_eligible: true,
        organization_kind: "juridical_person",
        claimed_workspace_id: null,
        claim_reservation_id: null,
        account_email: "owner@safe.example",
        invitation_id: INVITATION_ID,
        invitation_email: "owner@safe.example",
      }];
    }
    if (query.includes("set claim_reservation_id =") && query.includes("current_claim")) {
      return [{ id: PROFILE_ID }];
    }
    if (query.includes("update company_directory_claims claim") && query.includes("status = 'verified'")) {
      return [{ id: CLAIM_ID }];
    }
    if (query.includes("with eligible_invitation as")) {
      return [{ id: CLAIM_ID }];
    }
    return [];
  });
  return { sql, queries };
}

function publishedRevalidationSql() {
  return vi.fn(async (strings: TemplateStringsArray) => {
    const query = strings.join(" ");
    if (query.includes("insert into company_directory_sync_runs")) {
      return [{ id: RUN_ID }];
    }
    if (query.includes("select profile.id::text, profile.organization_number")) {
      return [{ id: PROFILE_ID, organization_number: "5560000000", display_name: "Safe Company AB" }];
    }
    if (query.includes("profile.updated_at::text as profile_updated_token")) {
      return [{
        id: PROFILE_ID,
        country_code: "SE",
        organization_kind: "juridical_person",
        publication_status: "published",
        category_slug: "vvs",
        primary_sni_code: "43.221",
        legal_name: "Safe Company AB",
        display_name: "Safe Company AB",
        activity_description: "VVS",
        is_active: true,
        privacy_blocked: true,
        auto_public_eligible: false,
        claimed_workspace_id: null,
        profile_updated_token: "profile-v1",
        registered_names: [],
        sni_codes: [],
        deregistration_date: null,
        advertising_blocked: false,
        ongoing_procedures: [],
        facts_last_synced_token: "facts-v1",
        facts_source_payload_hash: "facts-hash",
        scb_source_payload_hash: "scb-hash",
        scb_conflict_count: 0,
        official_facts_fresh: true,
        scb_snapshot_fresh: true,
      }];
    }
    if (query.includes("set publication_status = 'review'")) {
      return [{ id: PROFILE_ID }];
    }
    if (query.includes("select count(*)::int as count")) {
      return [{ count: 0 }];
    }
    return [];
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.assessConfidence.mockReturnValue({ officialFactsReady: true, score: 100 });
  mocks.enrichScb.mockResolvedValue({ status: "saved", conflicts: [] });
  mocks.enrichOfficialFacts.mockResolvedValue({ status: "saved" });
  mocks.createScbTransport.mockReturnValue({ transport: "test" });
  mocks.assessDirectoryCandidate.mockReturnValue({
    publicationStatus: "blocked",
    category: null,
    reasons: ["privacy_blocked"],
    score: 0,
    privacyBlocked: true,
    autoPublicEligible: false,
  });
  mocks.buildDirectoryPublicSlug.mockReturnValue("new-computed-slug");
  mocks.mapPrimarySni.mockReturnValue(null);
  mocks.createWorkspaceSlug.mockReturnValue("safe-company");
  mocks.getPlatformAdmin.mockResolvedValue({ role: "super_admin", userId: "admin-1" });
  mocks.parseClaimEmailEvidence.mockReturnValue({
    businessEmail: "owner@safe.example",
    phone: "0700000000",
  });
  mocks.isClaimBusinessEmailVerified.mockReturnValue(true);
  mocks.serializeClaimEmailEvidence.mockReturnValue("approved-evidence");
  mocks.validBusinessEmail.mockReturnValue(true);
  mocks.businessEmailDomainKind.mockReturnValue("business_domain");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("public Directory safety mutation invalidation", () => {
  it("invalidates the affected profile immediately after successful publication", async () => {
    mocks.getSql.mockReturnValue(publicationSql());

    const { publishCompanyDirectoryProfileIfSafe } = await import("@/lib/company-directory-publication");
    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
      ok: true,
      code: "published",
      slug: "safe-company-ab",
    });

    expect(mocks.invalidateProjection).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateProjection).toHaveBeenCalledWith({
      slug: "safe-company-ab",
      profileId: PROFILE_ID,
    });
  });

  it("uses the persisted public_slug when an upsert keeps an older stored slug", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("insert into company_directory_profiles")) {
        return [{
          id: PROFILE_ID,
          public_slug: "stored-old-slug",
          publication_status: "blocked",
          category_slug: "",
        }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const { upsertCompanyDirectoryCandidate } = await import("@/lib/company-directory-engine");
    const candidate = {
      countryCode: "SE",
      organizationNumber: "5560000000",
      organizationKind: "juridical_person",
      legalName: "Safe Company AB",
      displayName: "Renamed Company AB",
      legalForm: "AB",
      organizationStatus: "active",
      isActive: true,
      fTaxStatus: "registered",
      vatStatus: "registered",
      employerStatus: "registered",
      primarySniCode: "43.221",
      primarySniLabel: "VVS",
      activityDescription: "VVS",
      addressLine1: "Testgatan 1",
      postalCode: "11122",
      city: "Stockholm",
      municipality: "Stockholm",
      region: "Stockholm",
      officialSource: "test",
      sourceRecordId: "source-1",
      sourceUpdatedAt: null,
    } as never;

    await expect(upsertCompanyDirectoryCandidate(candidate)).resolves.toMatchObject({
      profileId: PROFILE_ID,
      publicationStatus: "blocked",
      blocked: true,
    });

    expect(mocks.buildDirectoryPublicSlug).toHaveReturnedWith("new-computed-slug");
    expect(mocks.invalidateProjection).toHaveBeenCalledWith({
      slug: "stored-old-slug",
      profileId: PROFILE_ID,
    });
    expect(mocks.invalidateProjection).not.toHaveBeenCalledWith({
      slug: "new-computed-slug",
      profileId: PROFILE_ID,
    });
  });

  it("fails closed with global invalidation when persisted public_slug is unavailable", async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("insert into company_directory_profiles")) {
        return [{ id: PROFILE_ID, public_slug: "", publication_status: "blocked", category_slug: "" }];
      }
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const { upsertCompanyDirectoryCandidate } = await import("@/lib/company-directory-engine");
    await upsertCompanyDirectoryCandidate({
      countryCode: "SE",
      organizationNumber: "5560000000",
      organizationKind: "juridical_person",
      legalName: "Safe Company AB",
      displayName: "Safe Company AB",
      legalForm: "AB",
      organizationStatus: "active",
      isActive: true,
      fTaxStatus: "registered",
      vatStatus: "registered",
      employerStatus: "registered",
      primarySniCode: "43.221",
      primarySniLabel: "VVS",
      activityDescription: "VVS",
      addressLine1: "Testgatan 1",
      postalCode: "11122",
      city: "Stockholm",
      municipality: "Stockholm",
      region: "Stockholm",
      officialSource: "test",
      sourceRecordId: "source-1",
      sourceUpdatedAt: null,
    } as never);

    expect(mocks.invalidateAll).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateProjection).not.toHaveBeenCalled();
  });

  it("keeps publication success after post-commit cache invalidation fails", async () => {
    const cacheError = new Error("cache invalidate failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getSql.mockReturnValue(publicationSql());
    mocks.invalidateProjection.mockImplementationOnce(() => {
      throw cacheError;
    });

    const { publishCompanyDirectoryProfileIfSafe } = await import("@/lib/company-directory-publication");
    await expect(publishCompanyDirectoryProfileIfSafe(PROFILE_ID)).resolves.toEqual({
      ok: true,
      code: "published",
      slug: "safe-company-ab",
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to invalidate public Directory cache after committed publication",
      { profileId: PROFILE_ID, slug: "safe-company-ab", error: cacheError },
    );
  });

  it("keeps a committed published demotion counted when cache invalidation fails", async () => {
    const cacheError = new Error("cache invalidate failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getSql.mockReturnValue(publishedRevalidationSql());
    mocks.invalidateByProfileId.mockRejectedValueOnce(cacheError);

    const { revalidatePublishedCompanyDirectoryBatch } = await import(
      "@/lib/company-directory-published-revalidation"
    );
    const result = await revalidatePublishedCompanyDirectoryBatch(1);

    expect(result).toMatchObject({ movedToReview: 1, errors: 0, revalidated: 1 });
    expect(mocks.invalidateByProfileId).toHaveBeenCalledWith(PROFILE_ID);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to invalidate public Directory cache after committed published demotion",
      { profileId: PROFILE_ID, error: cacheError },
    );
  });

  it("keeps an existing-workspace claim successful when post-commit invalidation fails", async () => {
    const cacheError = new Error("cache invalidate failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sql = vi.fn(async () => [{ id: CLAIM_ID }]);
    mocks.getSql.mockReturnValue(sql);
    mocks.invalidateByProfileId.mockRejectedValueOnce(cacheError);

    const { finalizeCompanyDirectoryClaimIntoExistingWorkspace } = await import(
      "@/lib/company-directory-existing-workspace-claim"
    );

    await expect(finalizeCompanyDirectoryClaimIntoExistingWorkspace({
      claimId: CLAIM_ID,
      profileId: PROFILE_ID,
      workspaceId: WORKSPACE_ID,
      claimantUserId: "user-1",
      adminUserId: "admin-1",
      adminReference: "verified",
      approvedEvidence: "evidence",
      activityDescription: "description",
    })).resolves.toMatchObject({ claimId: CLAIM_ID, workspaceId: WORKSPACE_ID });

    expect(sql).toHaveBeenCalledTimes(1);
    expect(mocks.invalidateByProfileId).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to invalidate public Directory cache after committed existing-workspace claim",
      { claimId: CLAIM_ID, profileId: PROFILE_ID, error: cacheError },
    );
  });

  it("keeps an admin-provisioned claim successful when post-commit invalidation fails", async () => {
    const cacheError = new Error("cache invalidate failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { sql, queries } = adminClaimSql();
    mocks.getSql.mockReturnValue(sql);
    mocks.provisionWorkspace.mockResolvedValue({ workspaceId: CLAIM_ID, trialEndsAt: null });
    mocks.invalidateByProfileId.mockRejectedValueOnce(cacheError);

    const { approveAndProvisionCompanyDirectoryClaim } = await import("@/lib/company-directory-claims-admin");
    await expect(approveAndProvisionCompanyDirectoryClaim({
      claimId: CLAIM_ID,
      reference: "verified by admin",
    })).resolves.toMatchObject({ claimId: CLAIM_ID, workspaceId: CLAIM_ID });

    expect(mocks.provisionWorkspace).toHaveBeenCalledTimes(1);
    expect(queries.filter((query) => query.includes("set status = 'claimed'")).length).toBe(1);
    expect(mocks.invalidateByProfileId).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to invalidate public Directory cache after committed provisioned claim",
      { claimId: CLAIM_ID, profileId: PROFILE_ID, error: cacheError },
    );
  });

  it("keeps a Marketplace-provisioned claim successful when post-commit invalidation fails", async () => {
    const cacheError = new Error("cache invalidate failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { sql, queries } = marketplaceClaimSql();
    mocks.getSql.mockReturnValue(sql);
    mocks.provisionWorkspace.mockResolvedValue({ workspaceId: CLAIM_ID, trialEndsAt: null });
    mocks.invalidateByProfileId.mockRejectedValueOnce(cacheError);

    const { tryAutoProvisionMarketplaceCompanyClaim } = await import("@/lib/company-directory-marketplace-claim");
    await expect(tryAutoProvisionMarketplaceCompanyClaim({
      claimId: CLAIM_ID,
      claimantUserId: "user-1",
    })).resolves.toEqual({ status: "provisioned", workspaceId: CLAIM_ID });

    expect(mocks.provisionWorkspace).toHaveBeenCalledTimes(1);
    expect(queries.filter((query) => query.includes("with eligible_invitation as")).length).toBe(1);
    expect(mocks.invalidateByProfileId).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to invalidate public Directory cache after committed Marketplace claim",
      { claimId: CLAIM_ID, profileId: PROFILE_ID, error: cacheError },
    );
  });

  it("globally expires public Directory caches when a batch safety sweep demotes profiles", async () => {
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
    const response = await GET(cronRequest());

    expect(response.status).toBe(200);
    expect(mocks.invalidateAll).toHaveBeenCalledTimes(2);
  });

  it("invalidates fail-closed on category-policy batch failure without replacing the original error", async () => {
    const batchError = new Error("policy batch failed after demotion");
    const cacheError = new Error("cache invalidation also failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.policyBatch.mockRejectedValueOnce(batchError);
    mocks.fullBatch.mockResolvedValue({
      skipped: false,
      selected: 0,
      refreshed: 0,
      kept: 0,
      movedToReview: 0,
      recoveredToReady: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      remaining: 0,
    });
    mocks.invalidateAll.mockImplementationOnce(() => {
      throw cacheError;
    });

    const { GET } = await import("@/app/api/cron/company-directory-revalidation/route");
    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.policyEvaluation).toMatchObject({
      reason: "worker_error",
      errorSummary: "policy batch failed after demotion",
    });
    expect(mocks.invalidateAll).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Public Directory cache invalidation failed after committed revalidation work",
      { context: "category_policy_batch_failure", error: cacheError },
    );
  });

  it("invalidates fail-closed on full-batch failure without replacing the original error", async () => {
    const batchError = new Error("full batch failed after demotion");
    const cacheError = new Error("cache invalidation also failed");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.policyBatch.mockResolvedValue({
      policyVersion: "test-policy",
      reason: undefined,
      selected: 0,
      evaluated: 0,
      kept: 0,
      movedToReview: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      remaining: 0,
    });
    mocks.fullBatch.mockRejectedValueOnce(batchError);
    mocks.invalidateAll.mockImplementationOnce(() => {
      throw cacheError;
    });

    const { GET } = await import("@/app/api/cron/company-directory-revalidation/route");
    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("full batch failed after demotion");
    expect(mocks.invalidateAll).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "Public Directory cache invalidation failed after committed revalidation work",
      { context: "full_revalidation_batch_failure", error: cacheError },
    );
  });
});
