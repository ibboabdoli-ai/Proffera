import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  readResetToken,
  resetLocaleTarget,
  resetUrlWithoutFragment,
} from "../src/app/aterstall-losenord/ResetPasswordForm";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("password reset UI and privacy contract", () => {
  const loginForm = source("src/app/logga-in/LoginForm.tsx");
  const loginPage = source("src/app/logga-in/page.tsx");
  const requestPage = source("src/app/glomt-losenord/page.tsx");
  const requestForm = source("src/app/glomt-losenord/PasswordResetRequestForm.tsx");
  const resetPage = source("src/app/aterstall-losenord/page.tsx");
  const resetForm = source("src/app/aterstall-losenord/ResetPasswordForm.tsx");
  const analytics = source("src/components/analytics/posthog-analytics.tsx");

  it("links both login languages to the recovery entry point and reports reset completion", () => {
    expect(loginForm).toContain("Glömt lösenordet?");
    expect(loginForm).toContain("Forgot your password?");
    expect(loginForm).toContain("/glomt-losenord?lang=en");
    expect(loginPage).toContain('reset?: string | string[]');
    expect(loginPage).toContain("Lösenordet är uppdaterat");
    expect(loginPage).toContain("Your password has been updated");
  });

  it("keeps forgot-password responses generic and bilingual without checking account existence in the UI", () => {
    expect(requestForm).toContain("authClient.requestPasswordReset");
    expect(requestForm).toContain("Om det finns ett konto med den e-postadressen");
    expect(requestForm).toContain("If an account exists for that email address");
    expect(requestForm).not.toMatch(/userExists|accountExists|findUserByEmail/);
    expect(requestPage).toContain("Av säkerhetsskäl visar vi inte om adressen finns registrerad");
    expect(requestPage).toContain("we do not reveal whether the address is registered");
  });

  it("reads the single-use token only from the browser fragment and scrubs it before reset submission", () => {
    expect(resetForm).toContain("window.location.hash");
    expect(resetForm).toContain("window.history.replaceState");
    expect(resetForm).toContain("authClient.resetPassword");
    expect(resetForm).toContain("window.location.replace");
    expect(resetForm).not.toContain("window.location.searchParams");
    expect(resetForm).toContain("minLength={8}");
    expect(resetForm).toContain("maxLength={128}");
    expect(resetPage).toContain("tidigare Proffera-sessioner");
    expect(resetPage).toContain("previous Proffera sessions are revoked");
  });

  it("preserves the in-memory reset token when switching language after the URL fragment is scrubbed", () => {
    const token = "ABCDEFGHIJKLMNOPQRSTUVWX";

    expect(readResetToken(`#token=${token}`)).toBe(token);
    expect(resetUrlWithoutFragment("/aterstall-losenord", "?lang=en"))
      .toBe("/aterstall-losenord?lang=en");
    expect(resetLocaleTarget("en", token))
      .toBe(`/aterstall-losenord?lang=en#token=${token}`);
    expect(resetLocaleTarget("sv", token))
      .toBe(`/aterstall-losenord#token=${token}`);
    expect(resetPage).not.toContain('href="/aterstall-losenord?lang=en"');
  });

  it("keeps PostHog pageview capture query-free so reset fragments or query tokens are not projected", () => {
    expect(analytics).toContain("capture_pageview: false");
    expect(analytics).toContain("autocapture: false");
    expect(analytics).toContain("disable_session_recording: true");
    expect(analytics).toContain("sanitizePageUrl(window.location.origin, sanitizedPathname)");
    expect(analytics).not.toContain("window.location.href");
  });
});
