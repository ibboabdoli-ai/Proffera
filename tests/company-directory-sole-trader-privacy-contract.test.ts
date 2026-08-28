import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ownerVisibleDirectoryOrganizationNumber,
  providerProfileCanOpenPublicPage,
} from "../src/lib/company-directory-provider-activation";
import { publicDirectoryOrganizationNumber } from "../src/lib/company-directory-public-data";

describe("sole-trader privacy projection contract", () => {
  it("discloses organization numbers only for explicitly juridical Directory profiles", () => {
    expect(publicDirectoryOrganizationNumber("juridical_person", "5561234567")).toBe("5561234567");
    expect(publicDirectoryOrganizationNumber("sole_trader", "sole-trader-opaque")).toBe("");
    expect(publicDirectoryOrganizationNumber("unknown", "5561234567")).toBe("");
    expect(publicDirectoryOrganizationNumber(null, "5561234567")).toBe("");
  });

  it("uses the same fail-closed disclosure policy in the owner Marketplace projection", () => {
    expect(ownerVisibleDirectoryOrganizationNumber("juridical_person", "5561234567")).toBe("5561234567");
    expect(ownerVisibleDirectoryOrganizationNumber("sole_trader", "sole-trader-opaque")).toBe("");
    expect(ownerVisibleDirectoryOrganizationNumber("unknown", "5561234567")).toBe("");
    expect(ownerVisibleDirectoryOrganizationNumber(undefined, "5561234567")).toBe("");
  });

  it("does not expose an inactive claimed profile even when all other public-page gates pass", () => {
    const otherwiseEligible = {
      publication_status: "claimed",
      privacy_blocked: false,
      auto_public_eligible: true,
      published_at: new Date("2026-08-28T00:00:00Z"),
    };

    expect(providerProfileCanOpenPublicPage({ ...otherwiseEligible, is_active: false })).toBe(false);
    expect(providerProfileCanOpenPublicPage({ ...otherwiseEligible, is_active: true })).toBe(true);
  });
});
