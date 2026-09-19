import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("auth and signup human-designed UX contract", () => {
  it("keeps login routing and recovery behavior while using the unified auth shell", () => {
    const page = source("src/app/logga-in/page.tsx");
    const form = source("src/app/logga-in/LoginForm.tsx");

    expect(page).toContain("resolveSafeClaimLoginNext");
    expect(page).toContain("resolveOwnerPostLoginPath");
    expect(page).toContain("authLocaleHref");
    expect(page).toContain("auth-marketplace.module.css");
    expect(form).toContain('fetch("/api/auth/sign-in/email"');
    expect(form).toContain("rememberMe: true");
    expect(form).toContain("/glomt-losenord?lang=en");
    expect(form).toContain("authStyles.primaryButton");
    expect(form).toContain('const safeLocale: SignupLocale = locale === "en" ? "en" : "sv";');
    expect(form).toContain('const safePlan: CheckoutPlanKey = plan === "professional" ? "professional" : "starter";');
    expect(form).toContain("<a href={loginHref}");
    expect(form).not.toContain('import Link from "next/link"');
  });

  it("keeps signup account/workspace creation semantics while aligning presentation", () => {
    const page = source("src/components/signup/signup-page.tsx");
    const form = source("src/components/signup/signup-form.tsx");

    expect(page).toContain("getServerSession");
    expect(page).toContain("workspace_memberships");
    expect(page).toContain("auth-marketplace.module.css");
    expect(form).toContain("authClient");
    expect(form).toContain("initialPlan");
    expect(form).toContain("accountReady");
    expect(form).toContain("authStyles.primaryButton");
  });

  it("keeps password reset privacy, token scrubbing, and session revocation messaging", () => {
    const requestPage = source("src/app/glomt-losenord/page.tsx");
    const requestForm = source("src/app/glomt-losenord/PasswordResetRequestForm.tsx");
    const resetPage = source("src/app/aterstall-losenord/page.tsx");
    const resetForm = source("src/app/aterstall-losenord/ResetPasswordForm.tsx");

    expect(requestPage).toContain("Av säkerhetsskäl visar vi inte om adressen finns registrerad");
    expect(requestForm).toContain("authClient.requestPasswordReset");
    expect(resetForm).toContain("window.location.hash");
    expect(resetForm).toContain("window.history.replaceState");
    expect(resetForm).toContain("authClient.resetPassword");
    expect(resetForm).toContain("window.location.replace");
    expect(resetPage).toContain("tidigare Proffera-sessioner");
    expect(requestPage).toContain("auth-marketplace.module.css");
    expect(resetPage).toContain("auth-marketplace.module.css");
  });

  it("avoids the previous green radial-gradient auth treatment", () => {
    const styles = source("src/components/auth/auth-marketplace.module.css");
    const page = source("src/app/logga-in/page.tsx");
    const signup = source("src/components/signup/signup-page.tsx");

    expect(styles).toContain("#0a2e63");
    expect(styles).toContain("#1469d8");
    expect(styles).toContain("prefers-reduced-motion");
    expect(page).not.toContain("radial-gradient");
    expect(signup).not.toContain("radial-gradient");
  });

  it("keeps activation and member invitations bilingual with locale-preserving redirects", () => {
    const activation = source("src/app/aktivera/[token]/activation-view.tsx");
    const activationForm = source("src/app/aktivera/[token]/activation-form.tsx");
    const invite = source("src/app/bjud-in/[token]/page.tsx");
    const inviteAction = source("src/app/bjud-in/[token]/actions.ts");

    expect(activation).toContain('sv: {');
    expect(activation).toContain('en: {');
    expect(activation).toContain("applyActivationLocaleChange");
    expect(activation).toContain("authStyles.languageButton");
    expect(activationForm).toContain('name="lang"');
    expect(invite).toContain('sv: {');
    expect(invite).toContain('en: {');
    expect(invite).toContain("authStyles.languageLink");
    expect(invite).toContain("<ActivationForm");
    expect(inviteAction).toContain('formData.get("lang")');
    expect(inviteAction).toContain('"/logga-in?lang=en&created=1"');
  });
});
