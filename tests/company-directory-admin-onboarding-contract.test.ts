import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  redirect: vi.fn(),
  requireSuperAdmin: vi.fn(),
  isJuridicalOrganizationNumber: vi.fn(),
  upsertCompanyDirectoryCandidate: vi.fn(),
  enrichCompanyDirectoryOfficialFactsForProfile: vi.fn(),
  normalizeOrganizationNumber: vi.fn(),
  autoPublishCompanyDirectoryProfileIfSafe: vi.fn(),
  verifyOfficialCompanyCandidate: vi.fn(),
  getSql: vi.fn(),
  allowPublicSubmission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/admin-authorization", () => ({
  requireSuperAdmin: mocks.requireSuperAdmin,
}));
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
  normalizeSwedishOrganizationNumber: mocks.normalizeOrganizationNumber,
}));
vi.mock("@/lib/company-directory-publication", () => ({
  autoPublishCompanyDirectoryProfileIfSafe: mocks.autoPublishCompanyDirectoryProfileIfSafe,
}));
vi.mock("@/lib/company-directory-source", () => ({
  verifyOfficialCompanyCandidate: mocks.verifyOfficialCompanyCandidate,
}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/public-form-protection", () => ({
  allowPublicSubmission: mocks.allowPublicSubmission,
}));

import { addCompanyDirectoryFromAdminAction } from "../src/app/admin/foretag/directory/lagg-till-foretag/actions";
import { onboardJuridicalCompanyDirectoryByOrganizationNumber } from "../src/lib/company-directory-juridical-onboarding";

const ADMIN_ID = "admin-user-1";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const JURIDICAL_ORG = "5561234567";
const PRIVATE_IDENTITY = "9001011234";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function normalizeOrganizationNumber(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
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
    sourceUpdatedAt: new Date("2026-09-14T00:00:00Z"),
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

function formData(value: string, workspaceId?: string) {
  const form = new FormData();
  form.set("organizationNumber", value);
  if (workspaceId) form.set("workspaceId", workspaceId);
  return form;
}

function expectRedirect(target: string) {
  return new Error(`NEXT_REDIRECT:${target}`);
}

describe("super-admin Company Directory onboarding", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();

    mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" }));
    mocks.redirect.mockImplementation((target: string) => {
      throw expectRedirect(target);
    });
    mocks.requireSuperAdmin.mockResolvedValue({
      userId: ADMIN_ID,
      role: "super_admin",
      email: "admin@example.com",
      name: "Admin",
    });
    mocks.normalizeOrganizationNumber.mockImplementation(normalizeOrganizationNumber);
    mocks.isJuridicalOrganizationNumber.mockImplementation((value: unknown) => {
      const digits = String(value ?? "").replace(/\D/g, "");
      return /^\d{10}$/.test(digits) && Number(digits[2]) >= 2;
    });
    mocks.allowPublicSubmission.mockResolvedValue(true);
    mocks.enrichCompanyDirectoryOfficialFactsForProfile.mockResolvedValue({ ok: true });
    mocks.autoPublishCompanyDirectoryProfileIfSafe.mockResolvedValue({ published: true });
  });

  it("requires super-admin authorization before any Directory, source or rate-limit work", async () => {
    mocks.requireSuperAdmin.mockRejectedValue(new Error("Super admin access required"));

    await expect(addCompanyDirectoryFromAdminAction(formData(JURIDICAL_ORG)))
      .rejects.toThrow("Super admin access required");

    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.allowPublicSubmission).not.toHaveBeenCalled();
    expect(mocks.verifyOfficialCompanyCandidate).not.toHaveBeenCalled();
    expect(mocks.upsertCompanyDirectoryCandidate).not.toHaveBeenCalled();
  });

  it("fails closed for private identity shapes before persistence and never echoes the identifier", async () => {
    await expect(addCompanyDirectoryFromAdminAction(formData(PRIVATE_IDENTITY)))
      .rejects.toThrow(
        "NEXT_REDIRECT:/admin/foretag/directory/lagg-till-foretag?status=private_identity",
      );

    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.allowPublicSubmission).not.toHaveBeenCalled();
    expect(mocks.verifyOfficialCompanyCandidate).not.toHaveBeenCalled();
    expect(mocks.upsertCompanyDirectoryCandidate).not.toHaveBeenCalled();
    expect(mocks.enrichCompanyDirectoryOfficialFactsForProfile).not.toHaveBeenCalled();
    expect(mocks.autoPublishCompanyDirectoryProfileIfSafe).not.toHaveBeenCalled();
    expect(mocks.redirect.mock.calls[0]?.[0]).not.toContain(PRIVATE_IDENTITY);
  });

  it("also rejects private identity shapes at the shared helper boundary", async () => {
    await expect(onboardJuridicalCompanyDirectoryByOrganizationNumber({
      organizationNumber: PRIVATE_IDENTITY,
      rateLimit: { scope: "admin_directory_onboarding", identity: ADMIN_ID },
      source: "admin_onboarding",
    })).rejects.toThrow("private_identity");

    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.allowPublicSubmission).not.toHaveBeenCalled();
    expect(mocks.verifyOfficialCompanyCandidate).not.toHaveBeenCalled();
  });

  it("verifies before persistence, ignores client Workspace input, enriches facts and uses the publication gate", async () => {
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

    await expect(addCompanyDirectoryFromAdminAction(
      formData(JURIDICAL_ORG, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    )).rejects.toThrow(
      "NEXT_REDIRECT:/admin/foretag/directory/lagg-till-foretag?status=added",
    );

    expect(mocks.allowPublicSubmission).toHaveBeenCalledWith(expect.objectContaining({
      scope: "admin_directory_onboarding",
      identity: ADMIN_ID,
      maxAttempts: 6,
      windowSeconds: 3600,
    }));
    expect(mocks.verifyOfficialCompanyCandidate.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.upsertCompanyDirectoryCandidate.mock.invocationCallOrder[0]);
    expect(mocks.enrichCompanyDirectoryOfficialFactsForProfile).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.autoPublishCompanyDirectoryProfileIfSafe).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.redirect.mock.calls[0]?.[0]).not.toContain(JURIDICAL_ORG);
  });

  it("is idempotent for an existing published company and does not spend official-source quota", async () => {
    const sql = createSqlMock((text) =>
      text.includes("profile.country_code = 'SE'") ? [profileRow()] : []);
    mocks.getSql.mockReturnValue(sql);

    await expect(addCompanyDirectoryFromAdminAction(formData(JURIDICAL_ORG)))
      .rejects.toThrow(
        "NEXT_REDIRECT:/admin/foretag/directory/lagg-till-foretag?status=existing",
      );

    expect(mocks.allowPublicSubmission).not.toHaveBeenCalled();
    expect(mocks.verifyOfficialCompanyCandidate).not.toHaveBeenCalled();
    expect(mocks.upsertCompanyDirectoryCandidate).not.toHaveBeenCalled();
    expect(mocks.enrichCompanyDirectoryOfficialFactsForProfile).not.toHaveBeenCalled();
    expect(mocks.autoPublishCompanyDirectoryProfileIfSafe).not.toHaveBeenCalled();
  });

  it("keeps the admin route Workspace-neutral and owner onboarding Workspace-first", () => {
    const actionCode = source(
      "src/app/admin/foretag/directory/lagg-till-foretag/actions.ts",
    );
    const pageCode = source(
      "src/app/admin/foretag/directory/lagg-till-foretag/page.tsx",
    );
    const sharedCode = source("src/lib/company-directory-juridical-onboarding.ts");
    const ownerCode = source("src/lib/company-directory-owner-onboarding.ts");
    const layoutCode = source("src/app/admin/foretag/layout.tsx");

    expect(actionCode).toContain("await requireSuperAdmin()");
    expect(pageCode).toContain("await requireSuperAdmin()");
    expect(actionCode).not.toContain("getUserWorkspaceAccess");
    expect(actionCode).not.toContain('formData.get("workspaceId")');
    expect(actionCode).not.toContain("workspace_memberships");
    expect(sharedCode).not.toContain("getUserWorkspaceAccess");
    expect(sharedCode).not.toContain("selectedWorkspaceCookieName");
    expect(sharedCode).not.toContain("workspace_memberships");
    expect(sharedCode).not.toContain("claimed_workspace_id =");
    expect(layoutCode).toContain('href="/admin/foretag/directory/lagg-till-foretag"');

    const workspaceBoundary = ownerCode.indexOf("const access = await requireManageableWorkspace()");
    const identifierBoundary = ownerCode.indexOf(
      "const organizationNumber = normalizeSwedishOrganizationNumber(value)",
    );
    expect(workspaceBoundary).toBeGreaterThan(-1);
    expect(identifierBoundary).toBeGreaterThan(workspaceBoundary);
  });
});
