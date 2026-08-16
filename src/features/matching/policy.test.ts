import { describe, expect, it } from "vitest";

import {
  buildWorkspaceLeadSuggestions,
  type LeadMatchInput,
  type WorkspaceLeadCandidate,
} from "./policy";

const now = new Date("2026-08-16T20:00:00.000Z");

const lead: LeadMatchInput = {
  category: "Städning",
  service_type: "Hemstädning",
  city: "Södertälje",
};

function candidate(overrides: Partial<WorkspaceLeadCandidate> = {}): WorkspaceLeadCandidate {
  return {
    workspaceId: "11111111-1111-4111-8111-111111111111",
    companyName: "Verifierad Städ AB",
    primaryCity: "Södertälje",
    email: "kontakt@example.se",
    phone: "0700000000",
    workspaceStatus: "active",
    claimedProfileId: "22222222-2222-4222-8222-222222222222",
    claimedProfileCategorySlug: "stadning",
    claimedProfileIsActive: true,
    claimedProfilePrivacyBlocked: false,
    claimStatus: "claimed",
    claimVerifiedAt: "2026-08-01T10:00:00.000Z",
    claimResolvedAt: "2026-08-01T10:05:00.000Z",
    serviceId: "33333333-3333-4333-8333-333333333333",
    serviceName: "Hemstädning",
    serviceCategory: "Städning",
    serviceArea: "Södertälje",
    serviceIsActive: true,
    servicePublicStatus: "published",
    serviceConversionMode: "quote",
    featureMinimumPlan: "starter",
    workspaceFeatureEnabled: true,
    adminOverrideEnabled: null,
    planKey: "starter",
    planStatus: "active",
    planPeriodEnd: null,
    trialStatus: null,
    trialEndsAt: null,
    ...overrides,
  };
}

describe("workspace lead matching policy", () => {
  it("suggests an eligible claimed workspace with a published quote-capable service", () => {
    const result = buildWorkspaceLeadSuggestions(lead, [candidate()], now);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      companyName: "Verifierad Städ AB",
      email: "kontakt@example.se",
      serviceName: "Hemstädning",
      score: 100,
    });
    expect(result[0]?.reasons).toEqual(["verifierat företag", "kategori", "tjänst", "område"]);
  });

  it("excludes structurally unverified workspaces even when their name looks production-like or test-like", () => {
    const noClaim = candidate({
      companyName: "Riktigt Företag AB",
      claimedProfileId: "",
      claimStatus: "",
      claimVerifiedAt: null,
      claimResolvedAt: null,
    });
    const testNamedNoClaim = candidate({
      workspaceId: "44444444-4444-4444-8444-444444444444",
      companyName: "proffera-test-workspace",
      claimedProfileId: "",
      claimStatus: "",
      claimVerifiedAt: null,
      claimResolvedAt: null,
    });

    expect(buildWorkspaceLeadSuggestions(lead, [noClaim, testNamedNoClaim], now)).toEqual([]);
  });

  it("does not use workspace names as a hidden test exclusion", () => {
    const verifiedTestNamedWorkspace = candidate({ companyName: "proffera-test-workspace" });

    expect(buildWorkspaceLeadSuggestions(lead, [verifiedTestNamedWorkspace], now)).toHaveLength(1);
  });

  it("excludes workspaces when lead management is disabled", () => {
    expect(buildWorkspaceLeadSuggestions(lead, [candidate({ workspaceFeatureEnabled: false })], now)).toEqual([]);
    expect(buildWorkspaceLeadSuggestions(lead, [candidate({ adminOverrideEnabled: false })], now)).toEqual([]);
  });

  it("excludes unpublished, inactive, or booking-only services", () => {
    expect(buildWorkspaceLeadSuggestions(lead, [candidate({ servicePublicStatus: "draft" })], now)).toEqual([]);
    expect(buildWorkspaceLeadSuggestions(lead, [candidate({ serviceIsActive: false })], now)).toEqual([]);
    expect(buildWorkspaceLeadSuggestions(lead, [candidate({ serviceConversionMode: "book" })], now)).toEqual([]);
  });

  it("excludes recipients without a valid email", () => {
    expect(buildWorkspaceLeadSuggestions(lead, [candidate({ email: "" })], now)).toEqual([]);
    expect(buildWorkspaceLeadSuggestions(lead, [candidate({ email: "not-an-email" })], now)).toEqual([]);
  });

  it("fails closed when category or service evidence is incompatible", () => {
    expect(buildWorkspaceLeadSuggestions(lead, [candidate({ claimedProfileCategorySlug: "vvs" })], now)).toEqual([]);
    expect(buildWorkspaceLeadSuggestions(lead, [candidate({ serviceName: "Kontorsstädning", serviceCategory: "Företag" })], now)).toEqual([]);
  });

  it("returns an empty result when no candidate satisfies every safety boundary", () => {
    const candidates = [
      candidate({ email: "" }),
      candidate({ workspaceId: "55555555-5555-4555-8555-555555555555", servicePublicStatus: "hidden" }),
      candidate({ workspaceId: "66666666-6666-4666-8666-666666666666", workspaceFeatureEnabled: false }),
    ];

    expect(buildWorkspaceLeadSuggestions(lead, candidates, now)).toEqual([]);
  });

  it("deduplicates multiple eligible services from the same workspace and keeps the strongest match", () => {
    const broadService = candidate({
      serviceId: "77777777-7777-4777-8777-777777777777",
      serviceName: "Annan städning",
      serviceCategory: "Städning",
      serviceArea: "Stockholm",
    });
    const exactService = candidate();

    const result = buildWorkspaceLeadSuggestions(lead, [broadService, exactService], now);

    expect(result).toHaveLength(1);
    expect(result[0]?.serviceName).toBe("Hemstädning");
    expect(result[0]?.score).toBe(100);
  });
});
