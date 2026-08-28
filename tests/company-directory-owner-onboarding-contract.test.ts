import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  isJuridicalOrganizationNumber: vi.fn(),
  onboardOwnerSoleTrader: vi.fn(),
  upsertCompanyDirectoryCandidate: vi.fn(),
  enrichCompanyDirectoryOfficialFactsForProfile: vi.fn(),
  autoPublishCompanyDirectoryProfileIfSafe: vi.fn(),
  verifyOfficialCompanyCandidate: vi.fn(),
  getSql: vi.fn(),
  allowPublicSubmission: vi.fn(),
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/bolagsverket-api-policy", () => ({
  isBolagsverketJuridicalOrganizationNumber: mocks.isJuridicalOrganizationNumber,
}));
vi.mock("@/lib/company-directory-engine", () => ({
  upsertCompanyDirectoryCandidate: mocks.upsertCompanyDirectoryCandidate,
}));
vi.mock("@/lib/company-directory-official-facts", () => ({
  enrichCompanyDirectoryOfficialFactsForProfile: mocks.enrichCompanyDirectoryOfficialFactsForProfile,
}));
vi.mock("@/lib/company-directory-provider-activation-policy", () => ({
  normalizeSwedishOrganizationNumber: (value: unknown) => {
    const digits = String(value ?? "").replace(/\D/g, "");
    return /^\d{10}$/.test(digits) ? digits : null;
  },
}));
vi.mock("@/lib/company-directory-publication", () => ({
  autoPublishCompanyDirectoryProfileIfSafe: mocks.autoPublishCompanyDirectoryProfileIfSafe,
}));
vi.mock("@/lib/company-directory-sole-trader-owner", () => ({
  onboardOwnerSoleTrader: mocks.onboardOwnerSoleTrader,
}));
vi.mock("@/lib/company-directory-source", () => ({
  verifyOfficialCompanyCandidate: mocks.verifyOfficialCompanyCandidate,
}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/public-form-protection", () => ({
  allowPublicSubmission: mocks.allowPublicSubmission,
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
  canManageWorkspaceSettings: mocks.canManageWorkspaceSettings,
}));

import { onboardOwnerCompanyByOrganizationNumber } from "../src/lib/company-directory-owner-onboarding";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user-1";
const JURIDICAL_ORG = "5561234567";
const PRIVATE_SHAPE = "9001011234";

function ownerAccess() {
  return {
    ok: true as const,
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    workspaceSlug: "owner-company",
    workspaceName: "Owner Company",
    workspaceStatus: "active" as const,
    role: "owner" as const,
  };
}

function verifiedCandidate() {
  return {
    countryCode: "SE",
    organizationNumber: JURIDICAL_ORG,
    organizationKind: "juridical_person" as const,
    legalName: "Testbolaget AB",
    displayName: "Testbolaget AB",
    legalForm: "aktiebolag",
    organizationStatus: "aktiv",
    isActive: true,
    fTaxStatus: "registrerad",
    vatStatus: "registrerad",
    employerStatus: "registrerad",
    primarySniCode: "43.210",
    primarySniLabel: "Elinstallationer",
    primarySniVerified: true,
    activityDescription: "Elinstallationer",
    addressLine1: "Testgatan 1",
    postalCode: "15100",
    city: "Södertälje",
    municipality: "Södertälje",
    region: "Stockholm",
    officialSource: "bolagsverket_vardefulla_datamangder:detail",
    sourceRecordId: JURIDICAL_ORG,
    sourceUpdatedAt: new Date("2026-08-28T00:00:00Z"),
  };
}

type ProfileRow = {
  id: string;
  public_slug: string;
  display_name: string;
  publication_status: string;
  organization_kind: string;
  is_active: boolean;
  privacy_blocked: boolean;
  auto_public_eligible: boolean;
  claimed_workspace_id: string | null;
  claim_reservation_id: string | null;
};

function profileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: PROFILE_ID,
    public_slug: "testbolaget-ab-234567",
    display_name: "Testbolaget AB",
    publication_status: "published",
    organization_kind: "juridical_person",
    is_active: true,
    privacy_blocked: false,
    auto_public_eligible: true,
    claimed_workspace_id: null,
    claim_reservation_id: null,
    ...overrides,
  };
}

function queryText(strings: TemplateStringsArray) {
  return strings.join(" ? ").replace(/\s+/g, " ").replace(/\?\s+::/g, "?::").trim();
}

function createSqlMock(handler: (text: string, values: unknown[]) => unknown[]) {
  return vi.fn((strings: TemplateStringsArray, ...values: unknown[]) =>
    Promise.resolve(handler(queryText(strings), values)));
}

describe("owner-initiated company Directory onboarding", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" }));
    mocks.getUserWorkspaceAccess.mockResolvedValue(ownerAccess());
    mocks.canManageWorkspaceSettings.mockReturnValue(true);
    mocks.isJuridicalOrganizationNumber.mockReturnValue(true);
    mocks.onboardOwnerSoleTrader.mockResolvedValue({
      status: "sole_trader_review_pending",
      companyName: "Example Sole Trader",
    });
    mocks.allowPublicSubmission.mockResolvedValue(true);
    mocks.enrichCompanyDirectoryOfficialFactsForProfile.mockResolvedValue({ ok: true });
    mocks.autoPublishCompanyDirectoryProfileIfSafe.mockResolvedValue({ published: true });
  });

  it("requires a manageable Workspace before touching identifiers, database or official sources", async () => {
    mocks.getUserWorkspaceAccess.mockResolvedValue({ ok: false, reason: "no_session" });

    await expect(onboardOwnerCompanyByOrganizationNumber(JURIDICAL_ORG)).rejects.toThrow("workspace_access");

    expect(mocks.isJuridicalOrganizationNumber).not.toHaveBeenCalled();
    expect(mocks.onboardOwnerSoleTrader).not.toHaveBeenCalled();
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.allowPublicSubmission).not.toHaveBeenCalled();
    expect(mocks.verifyOfficialCompanyCandidate).not.toHaveBeenCalled();
    expect(mocks.upsertCompanyDirectoryCandidate).not.toHaveBeenCalled();
  });

  it("routes personnummer-shaped identifiers only into the dedicated privacy-safe sole-trader branch", async () => {
    const actualPolicy = await vi.importActual<typeof import("../src/lib/bolagsverket-api-policy")>(
      "../src/lib/bolagsverket-api-policy",
    );
    expect(actualPolicy.isBolagsverketJuridicalOrganizationNumber(PRIVATE_SHAPE)).toBe(false);
    expect(actualPolicy.isBolagsverketJuridicalOrganizationNumber(JURIDICAL_ORG)).toBe(true);
    mocks.isJuridicalOrganizationNumber.mockImplementation(
      actualPolicy.isBolagsverketJuridicalOrganizationNumber,
    );

    await expect(onboardOwnerCompanyByOrganizationNumber(PRIVATE_SHAPE)).resolves.toEqual({
      status: "sole_trader_review_pending",
      companyName: "Example Sole Trader",
    });

    expect(mocks.isJuridicalOrganizationNumber).toHaveBeenCalledWith(PRIVATE_SHAPE);
    expect(mocks.onboardOwnerSoleTrader).toHaveBeenCalledWith(PRIVATE_SHAPE);
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.allowPublicSubmission).not.toHaveBeenCalled();
    expect(mocks.verifyOfficialCompanyCandidate).not.toHaveBeenCalled();
    expect(mocks.upsertCompanyDirectoryCandidate).not.toHaveBeenCalled();
  });

  it("rate-limits a missing company before starting the official lookup", async () => {
    const sql = createSqlMock((text) => text.includes("profile.organization_number") ? [] : []);
    mocks.getSql.mockReturnValue(sql);
    mocks.allowPublicSubmission.mockResolvedValue(false);

    await expect(onboardOwnerCompanyByOrganizationNumber(JURIDICAL_ORG)).rejects.toThrow("rate_limited");

    expect(mocks.allowPublicSubmission).toHaveBeenCalledWith(expect.objectContaining({
      scope: "owner_directory_onboarding",
      identity: `${WORKSPACE_ID}:${USER_ID}`,
      maxAttempts: 6,
      windowSeconds: 3600,
    }));
    expect(mocks.verifyOfficialCompanyCandidate).not.toHaveBeenCalled();
    expect(mocks.upsertCompanyDirectoryCandidate).not.toHaveBeenCalled();
  });

  it("verifies before persistence, enriches Official Facts and publishes through the canonical gate", async () => {
    const sql = createSqlMock((text) => {
      if (text.includes("profile.country_code = 'SE'")) return [];
      if (text.includes("where profile.id = ?::uuid")) return [profileRow()];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);
    mocks.verifyOfficialCompanyCandidate.mockResolvedValue(verifiedCandidate());
    mocks.upsertCompanyDirectoryCandidate.mockResolvedValue({
      profileId: PROFILE_ID,
      publicSlug: "testbolaget-ab-234567",
      publicationStatus: "ready",
      qualityScore: 95,
    });

    await expect(onboardOwnerCompanyByOrganizationNumber(JURIDICAL_ORG)).resolves.toEqual({
      status: "available",
      profileSlug: "testbolaget-ab-234567",
      companyName: "Testbolaget AB",
    });

    const seed = mocks.verifyOfficialCompanyCandidate.mock.calls[0]?.[0];
    expect(seed).not.toHaveProperty("primarySniVerified");
    expect(mocks.allowPublicSubmission.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.verifyOfficialCompanyCandidate.mock.invocationCallOrder[0]);
    expect(mocks.verifyOfficialCompanyCandidate.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.upsertCompanyDirectoryCandidate.mock.invocationCallOrder[0]);
    expect(mocks.upsertCompanyDirectoryCandidate).toHaveBeenCalledWith(expect.objectContaining({
      organizationNumber: JURIDICAL_ORG,
      organizationKind: "juridical_person",
      primarySniCode: "43.210",
      primarySniVerified: true,
    }));
    expect(mocks.enrichCompanyDirectoryOfficialFactsForProfile).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.autoPublishCompanyDirectoryProfileIfSafe).toHaveBeenCalledWith(PROFILE_ID);
  });

  it("resumes an eligible persisted ready profile instead of getting stuck at not_ready", async () => {
    const rows = [
      profileRow({ publication_status: "ready" }),
      profileRow({ publication_status: "published" }),
    ];
    const sql = createSqlMock((text) => {
      if (text.includes("profile.country_code = 'SE'")) return [rows[0]!];
      if (text.includes("where profile.id = ?::uuid")) return [rows[1]!];
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(onboardOwnerCompanyByOrganizationNumber(JURIDICAL_ORG)).resolves.toEqual({
      status: "available",
      profileSlug: "testbolaget-ab-234567",
      companyName: "Testbolaget AB",
    });

    expect(mocks.verifyOfficialCompanyCandidate).not.toHaveBeenCalled();
    expect(mocks.upsertCompanyDirectoryCandidate).not.toHaveBeenCalled();
    expect(mocks.allowPublicSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.enrichCompanyDirectoryOfficialFactsForProfile).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.autoPublishCompanyDirectoryProfileIfSafe).toHaveBeenCalledWith(PROFILE_ID);
  });

  it("does not spend official-source quota for an already published eligible profile", async () => {
    const sql = createSqlMock((text) => text.includes("profile.country_code = 'SE'") ? [profileRow()] : []);
    mocks.getSql.mockReturnValue(sql);

    await expect(onboardOwnerCompanyByOrganizationNumber(JURIDICAL_ORG)).resolves.toEqual({
      status: "available",
      profileSlug: "testbolaget-ab-234567",
      companyName: "Testbolaget AB",
    });

    expect(mocks.allowPublicSubmission).not.toHaveBeenCalled();
    expect(mocks.verifyOfficialCompanyCandidate).not.toHaveBeenCalled();
    expect(mocks.enrichCompanyDirectoryOfficialFactsForProfile).not.toHaveBeenCalled();
  });

  it("keeps the identifier out of redirect query strings and exposes a missing-company entry point", () => {
    const addPage = readFileSync(
      resolve(process.cwd(), "src/app/dashboard/marknadsplats/lagg-till-foretag/page.tsx"),
      "utf8",
    );
    const marketplacePage = readFileSync(
      resolve(process.cwd(), "src/app/dashboard/marknadsplats/page.tsx"),
      "utf8",
    );

    expect(addPage).not.toContain('params.set("organizationNumber"');
    expect(addPage).toContain('code === "rate_limited"');
    expect(addPage).toContain('? "rate_limited"');
    expect(marketplacePage).toContain('/dashboard/marknadsplats/lagg-till-foretag');
    expect(marketplacePage).toContain('status === "not_found"');
  });
});
