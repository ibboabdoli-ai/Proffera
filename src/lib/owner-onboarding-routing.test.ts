import { describe, expect, it } from "vitest";

import { resolveOwnerPostLoginPath, shouldShowOwnerOnboardingPrompt } from "./owner-onboarding-routing";

describe("owner onboarding routing", () => {
  it("sends a newly created workspace account to onboarding after first sign-in", () => {
    expect(resolveOwnerPostLoginPath({ locale: "sv", accountCreated: true, selectedPlan: null }))
      .toBe("/dashboard/onboarding?lang=sv");
  });

  it("keeps an explicit checkout plan ahead of onboarding", () => {
    expect(resolveOwnerPostLoginPath({ locale: "en", accountCreated: true, selectedPlan: "professional" }))
      .toBe("/dashboard/installningar?plan=professional&lang=en");
  });

  it("keeps normal returning users on the dashboard", () => {
    expect(resolveOwnerPostLoginPath({ locale: "en", accountCreated: false, selectedPlan: null }))
      .toBe("/dashboard?lang=en");
  });

  it("prompts only managers with incomplete onboarding and zero active services", () => {
    expect(shouldShowOwnerOnboardingPrompt({ canManageSettings: true, onboardingComplete: false, activeServices: 0 })).toBe(true);
    expect(shouldShowOwnerOnboardingPrompt({ canManageSettings: false, onboardingComplete: false, activeServices: 0 })).toBe(false);
    expect(shouldShowOwnerOnboardingPrompt({ canManageSettings: true, onboardingComplete: true, activeServices: 0 })).toBe(false);
    expect(shouldShowOwnerOnboardingPrompt({ canManageSettings: true, onboardingComplete: false, activeServices: 1 })).toBe(false);
  });
});
