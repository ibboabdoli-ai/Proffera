import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("self-service signup contract", () => {
  it("creates a Better Auth account before provisioning the workspace", () => {
    const form = source("src/components/signup/signup-form.tsx");
    expect(form).toContain("authClient.signUp.email");
    expect(form).toContain('fetch("/api/signup/provision"');
    expect(form.indexOf("authClient.signUp.email")).toBeLessThan(form.indexOf('fetch("/api/signup/provision"'));
  });

  it("provisions only for the authenticated account and prevents a second trial workspace", () => {
    const route = source("src/app/api/signup/provision/route.ts");
    expect(route).toContain("getServerSession()");
    expect(route).toContain("where wm.user_id = ${userId}");
    expect(route).toContain("alreadyProvisioned: true");
    expect(route.indexOf("existingMemberships")).toBeLessThan(route.indexOf("await provisionWorkspace"));
  });

  it("uses the central workspace provisioning path for a real 14-day trial", () => {
    const provisioning = source("src/features/company/workspace-provisioning.ts");
    expect(provisioning).toContain("const TRIAL_DAYS = 14");
    expect(provisioning).toContain("${input.userId}, 'owner'");
    expect(provisioning).toContain("${planKey}, 'trialing', now()");
    expect(provisioning).toContain("${trialEnd}::timestamptz");
    expect(provisioning).toContain("from feature_catalog");
    expect(provisioning).toContain("where is_active = true");
  });

  it("preserves Starter and Professional plan selection through signup", () => {
    const swedishPricing = source("src/app/priser/page.tsx");
    const englishPricing = source("src/app/en/pricing/page.tsx");
    const swedishSignup = source("src/app/skapa-konto/page.tsx");
    const englishSignup = source("src/app/en/create-account/page.tsx");

    expect(swedishPricing).toContain("/skapa-konto?plan=");
    expect(englishPricing).toContain("/en/create-account?plan=");
    expect(swedishSignup).toContain("isCheckoutPlanKey");
    expect(englishSignup).toContain("isCheckoutPlanKey");
  });

  it("keeps demo interest collection separate from SaaS signup", () => {
    const joinPage = source("src/app/anslut-foretag/page.tsx");
    const demoForm = source("src/app/anslut-foretag/registrera/page.tsx");
    const home = source("src/app/page.tsx");

    expect(joinPage).toContain('ctaLabel="Boka demo"');
    expect(joinPage).not.toContain('ctaLabel="Registrera företag"');
    expect(demoForm).toContain("Ingen bokning eller betalning skapas här");
    expect(home).toContain('href="/skapa-konto"');
    expect(home).toContain('href="/demo"');
  });
});
