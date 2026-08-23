import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  provisionWorkspace: vi.fn(),
  createWorkspaceSlug: vi.fn(() => "ror-ab-test"),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/features/company/workspace-provisioning", () => ({
  provisionWorkspace: mocks.provisionWorkspace,
  createWorkspaceSlug: mocks.createWorkspaceSlug,
}));

import { guestClaimHref } from "@/app/offert/svara/[token]/guest-flow-locale";
import { buildMarketplaceGuestInvitationEmail } from "@/features/email/marketplace-guest-invitation-email";
import { tryAutoProvisionMarketplaceCompanyClaim } from "@/lib/company-directory-marketplace-claim";

const CLAIM_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const INVITATION_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_WORKSPACE_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "marketplace-owner-user";
const BUSINESS_EMAIL = "offert@rorfirma.se";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function queryText(strings: readonly string[] | undefined) {
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

function verifiedEvidence() {
  return JSON.stringify({
    version: 1,
    stage: "business_email_verified",
    claimantName: "Anna Andersson",
    role: "Ägare",
    businessEmail: BUSINESS_EMAIL,
    phone: "0701234567",
    accountEmail: BUSINESS_EMAIL,
    emailDomainKind: "business_domain",
    codeAttempts: 0,
    codeSentAt: "2026-08-23T10:00:00.000Z",
    businessEmailVerifiedAt: "2026-08-23T10:02:00.000Z",
  });
}

function baseClaimRow(overrides: Record<string, unknown> = {}) {
  return {
    claim_id: CLAIM_ID,
    claim_status: "pending",
    verification_method: "email_domain",
    verification_reference: verifiedEvidence(),
    requested_workspace_id: null,
    profile_id: PROFILE_ID,
    display_name: "Rör AB",
    city: "Södertälje",
    activity_description: "Rörarbeten",
    publication_status: "published",
    is_active: true,
    privacy_blocked: false,
    auto_public_eligible: true,
    organization_kind: "juridical_person",
    claimed_workspace_id: null,
    claim_reservation_id: null,
    account_email: BUSINESS_EMAIL,
    invitation_id: INVITATION_ID,
    invitation_email: BUSINESS_EMAIL,
    ...overrides,
  };
}

type SqlScenario = {
  reserve?: boolean;
  claimUpdate?: boolean;
  finalize?: boolean;
  cleanup?: boolean;
};

function scenarioSql(row: Record<string, unknown>, scenario: SqlScenario = {}) {
  return vi.fn(async (strings: TemplateStringsArray) => {
    const query = queryText(strings);

    if (query.includes("select claim.id::text as claim_id")) return [row];
    if (query.startsWith("update company_directory_profiles profile set claim_reservation_id")) {
      return scenario.reserve === false ? [] : [{ id: PROFILE_ID }];
    }
    if (query.startsWith("update company_directory_claims claim set requested_workspace_id")) {
      return scenario.claimUpdate === false ? [] : [{ id: CLAIM_ID }];
    }
    if (query.startsWith("with eligible_invitation as")) {
      return scenario.finalize === false ? [] : [{ id: CLAIM_ID }];
    }
    if (query.startsWith("with cleanup_candidate as")) {
      return scenario.cleanup === false ? [] : [{ id: CLAIM_ID }];
    }
    if (query.startsWith("select workspace.id::text from workspaces workspace")) {
      return scenario.cleanup === false ? [{ id: CLAIM_ID }] : [];
    }
    if (query.startsWith("update company_directory_profiles set claim_reservation_id = null")) return [];

    throw new Error(`Unexpected SQL in Marketplace claim test: ${query}`);
  });
}

async function runClaim(rowOverrides: Record<string, unknown> = {}, scenario: SqlScenario = {}) {
  const sql = scenarioSql(baseClaimRow(rowOverrides), scenario);
  mocks.getSql.mockReturnValue(sql);
  const result = await tryAutoProvisionMarketplaceCompanyClaim({
    claimId: CLAIM_ID,
    claimantUserId: USER_ID,
  });
  return { result, sql };
}

describe("Marketplace company profile claim conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createWorkspaceSlug.mockReturnValue("ror-ab-test");
    mocks.provisionWorkspace.mockResolvedValue({
      workspaceId: CLAIM_ID,
      trialEndsAt: "2026-09-06T10:00:00.000Z",
    });
  });

  it("routes the Guest Quote growth CTA through the existing public company profile", () => {
    expect(guestClaimHref("ror-ab", "sv")).toBe("/foretag/listad/ror-ab?from=marketplace");
    expect(guestClaimHref("ror-ab", "en")).toBe("/en/companies/ror-ab?from=marketplace");

    const swedishProfile = source("src/app/foretag/listad/[slug]/page.tsx");
    const englishProfile = source("src/app/en/companies/[slug]/page.tsx");
    const prompt = source("src/components/company-directory/marketplace-profile-claim-prompt.tsx");

    expect(swedishProfile).toContain('first(query?.from) === "marketplace"');
    expect(englishProfile).toContain('first(query?.from) === "marketplace"');
    expect(prompt).toContain("Verifiera företaget");
    expect(prompt).toContain("same business email address that received the request");
  });

  it("adds a profile-verification path to the live company invitation email", () => {
    const email = buildMarketplaceGuestInvitationEmail({
      recipientEmail: BUSINESS_EMAIL,
      companyName: "Rör AB",
      quoteReferenceId: "PF-1234",
      category: "VVS",
      serviceType: "Rörmokare",
      city: "Södertälje",
      preferredDate: "2026-08-25",
      replyUrl: "https://www.proffera.se/offert/svara/secure-token",
      optOutUrl: "https://www.proffera.se/offert/svara/secure-token/avregistrera",
      idempotencyKey: CLAIM_ID,
    });

    expect(email.text).toContain("Proffera har redan en företagsprofil");
    expect(email.text).toContain("https://www.proffera.se/offert/svara/secure-token/profil");
    expect(email.html).toContain("Visa företagsprofil och verifiera");
  });

  it("resolves the signed Guest Quote token to the matching profile without granting access", () => {
    const redirectRoute = source("src/app/offert/svara/[token]/profil/route.ts");
    expect(redirectRoute).toContain("getMarketplaceGuestQuoteView(token)");
    expect(redirectRoute).toContain('target.searchParams.set("from", "marketplace")');
    expect(redirectRoute).not.toContain("provisionWorkspace");
    expect(redirectRoute).not.toContain("claimed_workspace_id");
  });

  it("keeps a missing Marketplace invitation in manual review", async () => {
    const { result } = await runClaim({ invitation_id: null, invitation_email: null });

    expect(result).toEqual({ status: "manual_review", reason: "marketplace_invitation_missing" });
    expect(mocks.provisionWorkspace).not.toHaveBeenCalled();
  });

  it("keeps an invitation email mismatch in manual review", async () => {
    const { result } = await runClaim({ invitation_email: "annan@rorfirma.se" });

    expect(result).toEqual({ status: "manual_review", reason: "marketplace_email_mismatch" });
    expect(mocks.provisionWorkspace).not.toHaveBeenCalled();
  });

  it("keeps an unpublished profile in manual review", async () => {
    const { result } = await runClaim({ publication_status: "review" });

    expect(result).toEqual({ status: "manual_review", reason: "profile_not_eligible" });
    expect(mocks.provisionWorkspace).not.toHaveBeenCalled();
  });

  it("does not auto-provision into an unrelated existing Workspace", async () => {
    const { result } = await runClaim({ requested_workspace_id: OTHER_WORKSPACE_ID });

    expect(result).toEqual({ status: "manual_review", reason: "existing_workspace_requested" });
    expect(mocks.provisionWorkspace).not.toHaveBeenCalled();
  });

  it("keeps a reservation race in manual review", async () => {
    const { result } = await runClaim({}, { reserve: false });

    expect(result).toEqual({ status: "manual_review", reason: "reservation_conflict" });
    expect(mocks.provisionWorkspace).not.toHaveBeenCalled();
  });

  it("provisions the deterministic claim Workspace on the fully verified path", async () => {
    const { result } = await runClaim();

    expect(result).toEqual({ status: "provisioned", workspaceId: CLAIM_ID });
    expect(mocks.provisionWorkspace).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: CLAIM_ID,
      userId: USER_ID,
      companyName: "Rör AB",
      city: "Södertälje",
      email: BUSINESS_EMAIL,
      planKey: "starter",
    }));
  });

  it("releases its reservation when Workspace provisioning itself fails", async () => {
    mocks.provisionWorkspace.mockRejectedValueOnce(new Error("provisioning failed"));

    const { result, sql } = await runClaim();

    expect(result).toEqual({ status: "manual_review", reason: "workspace_provision_failed" });
    const queries = sql.mock.calls.map((call) => queryText(call[0] as TemplateStringsArray));
    expect(queries.some((query) => query.startsWith("with cleanup_candidate as"))).toBe(false);
    expect(queries.some((query) => query.startsWith("update company_directory_profiles set claim_reservation_id = null"))).toBe(true);
    expect(queries.some((query) => query.startsWith("update company_directory_claims claim set requested_workspace_id"))).toBe(false);
  });

  it("compensates the provisioned Workspace before releasing a changed claim reservation", async () => {
    const { result, sql } = await runClaim({}, { claimUpdate: false });

    expect(result).toEqual({ status: "manual_review", reason: "claim_changed" });
    expect(mocks.provisionWorkspace).toHaveBeenCalledTimes(1);

    const queries = sql.mock.calls.map((call) => queryText(call[0] as TemplateStringsArray));
    const cleanupIndex = queries.findIndex((query) => query.startsWith("with cleanup_candidate as"));
    const releaseIndex = queries.findIndex((query) => query.startsWith("update company_directory_profiles set claim_reservation_id = null"));
    expect(cleanupIndex).toBeGreaterThan(-1);
    expect(releaseIndex).toBeGreaterThan(cleanupIndex);
  });

  it("compensates the provisioned Workspace before releasing a finalize conflict reservation", async () => {
    const { result, sql } = await runClaim({}, { finalize: false });

    expect(result).toEqual({ status: "manual_review", reason: "finalize_conflict" });
    expect(mocks.provisionWorkspace).toHaveBeenCalledTimes(1);

    const queries = sql.mock.calls.map((call) => queryText(call[0] as TemplateStringsArray));
    const finalizeIndex = queries.findIndex((query) => query.startsWith("with eligible_invitation as"));
    const cleanupIndex = queries.findIndex((query) => query.startsWith("with cleanup_candidate as"));
    const releaseIndex = queries.findIndex((query) => query.startsWith("update company_directory_profiles set claim_reservation_id = null"));
    expect(finalizeIndex).toBeGreaterThan(-1);
    expect(cleanupIndex).toBeGreaterThan(finalizeIndex);
    expect(releaseIndex).toBeGreaterThan(cleanupIndex);
  });

  it("preserves the reservation when finalize compensation cannot remove the Workspace", async () => {
    const { result, sql } = await runClaim({}, { finalize: false, cleanup: false });

    expect(result).toEqual({ status: "manual_review", reason: "finalize_conflict" });
    expect(mocks.provisionWorkspace).toHaveBeenCalledTimes(1);

    const queries = sql.mock.calls.map((call) => queryText(call[0] as TemplateStringsArray));
    expect(queries.some((query) => query.startsWith("with cleanup_candidate as"))).toBe(true);
    expect(queries.some((query) => query.startsWith("select workspace.id::text from workspaces workspace"))).toBe(true);
    expect(queries.some((query) => query.startsWith("update company_directory_profiles set claim_reservation_id = null"))).toBe(false);
  });
});
