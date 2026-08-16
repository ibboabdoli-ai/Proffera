import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Workspace setup UX 2.0", () => {
  it("scopes the presentation layer across appearance, features and onboarding", () => {
    const css = source("src/components/dashboard/workspace-setup-ux-2.module.css");
    const appearanceLayout = source("src/app/dashboard/installningar/utseende/layout.tsx");
    const featureLayout = source("src/app/dashboard/installningar/funktioner/layout.tsx");
    const onboardingLayout = source("src/app/dashboard/onboarding/layout.tsx");

    expect(css).toContain("var(--pf-brand)");
    expect(css).toContain("var(--pf-surface)");
    expect(css).toContain("var(--pf-line)");
    expect(css).toContain("var(--pf-radius-control)");
    expect(css).toContain("prefers-reduced-motion");
    expect(appearanceLayout).toContain("styles.scope");
    expect(appearanceLayout).toContain("data-appearance-builder-page");
    expect(appearanceLayout).toContain('import "./appearance-builder-shell.css"');
    expect(appearanceLayout).toContain('import "./salon-builder-preview.css"');
    expect(featureLayout).toContain("styles.scope");
    expect(onboardingLayout).toContain("styles.scope");
  });

  it("preserves appearance builder entitlements and protected custom-domain lifecycle", () => {
    const appearance = source("src/app/dashboard/installningar/utseende/page.tsx");

    expect(appearance).toContain('hasWorkspaceFeature("website_builder")');
    expect(appearance).toContain('hasWorkspaceFeature("custom_domain")');
    expect(appearance).toContain("normalizeCustomDomainInput");
    expect(appearance).toContain("ensureVercelCustomDomain");
    expect(appearance).toContain("removeVercelCustomDomain");
    expect(appearance).toContain("isPrimeViewHost");
    expect(appearance).toContain("setWorkspaceCustomDomainConnectionStatus");
    expect(appearance).toContain("updateWorkspaceExperienceSettings");
  });

  it("preserves feature entitlement toggle and trial behavior", () => {
    const features = source("src/app/dashboard/installningar/funktioner/page.tsx");

    expect(features).toContain("canManageWorkspaceSettings(access)");
    expect(features).toContain("getWorkspaceEntitlements");
    expect(features).toContain("setWorkspaceFeatureEnabled");
    expect(features).toContain("startWorkspaceFeatureTrial");
    expect(features).toContain('formData.get("featureKey")');
    expect(features).toContain('formData.get("enabled") === "true"');
  });

  it("preserves onboarding launch readiness, service seeding and workspace state", () => {
    const onboarding = source("src/app/dashboard/onboarding/page.tsx");

    expect(onboarding).toContain("canManageWorkspaceSettings(access)");
    expect(onboarding).toContain("seedWorkspaceServicesForIndustry");
    expect(onboarding).toContain("updateWorkspaceOnboarding");
    expect(onboarding).toContain("getDashboardWorkspaceBookingHours");
    expect(onboarding).toContain("getDashboardModuleAccess");
    expect(onboarding).toContain('module.id === "online_booking" && module.isEnabled');
    expect(onboarding).toContain("services.filter((service) => service.isActive).length");
    expect(onboarding).toContain("isComplete: launch.isReady");
  });
});
