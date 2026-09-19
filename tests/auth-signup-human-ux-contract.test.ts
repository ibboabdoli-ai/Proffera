import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage, { generateMetadata as loginMetadata } from "../src/app/logga-in/page";
import { generateMetadata as forgotPasswordMetadata } from "../src/app/glomt-losenord/page";
import { generateMetadata as resetPasswordMetadata } from "../src/app/aterstall-losenord/page";
import { generateMetadata as activationMetadata } from "../src/app/aktivera/[token]/page";
import { generateMetadata as memberInvitationMetadata } from "../src/app/bjud-in/[token]/page";
import { acceptMemberInvitationAction } from "../src/app/bjud-in/[token]/actions";

const invitationRuntime = vi.hoisted(() => ({
  redirect: vi.fn(),
  claimWorkspaceMemberInvitation: vi.fn(),
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      className,
    }: {
      href: unknown;
      children?: ReactNode;
      className?: string;
    }) => ReactModule.createElement("a", { href: String(href), className }, children),
  };
});

vi.mock("next/navigation", () => ({
  redirect: invitationRuntime.redirect,
}));

vi.mock("@/features/company/workspace-invitation", () => ({
  getWorkspaceInvitation: vi.fn(),
}));

vi.mock("../src/app/aktivera/[token]/actions", () => ({
  activateWorkspaceAction: vi.fn(),
}));

vi.mock("@/features/company/workspace-member-invitation", () => ({
  claimWorkspaceMemberInvitation: invitationRuntime.claimWorkspaceMemberInvitation,
}));

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
    expect(page).toContain("generateMetadata");
    expect(page).not.toContain('title: "Sign in | Proffera"');
    expect(page).not.toContain("För pilotkunder");
    expect(page).toContain("Företagsinloggning");
    expect(page).toContain("auth-marketplace.module.css");
    expect(form).toContain('fetch("/api/auth/sign-in/email"');
    expect(form).toContain("rememberMe: true");
    expect(form).toContain("/glomt-losenord?lang=en");
    expect(form).toContain("authStyles.primaryButton");
  });

  it("keeps signup presentation aligned with the unified auth shell", () => {
    const page = source("src/components/signup/signup-page.tsx");
    const form = source("src/components/signup/signup-form.tsx");

    expect(page).toContain("auth-marketplace.module.css");
    expect(form).toContain("authStyles.primaryButton");
    expect(form).toContain("<a href={loginHref}");
    expect(form).not.toContain('import Link from "next/link"');
  });

  it("renders the login page in Swedish and English at runtime", async () => {
    const swedish = renderToStaticMarkup(await LoginPage({
      searchParams: Promise.resolve({ lang: "sv" }),
    }));
    const english = renderToStaticMarkup(await LoginPage({
      searchParams: Promise.resolve({ lang: "en" }),
    }));
    const swedishProfessional = renderToStaticMarkup(await LoginPage({
      searchParams: Promise.resolve({ lang: "sv", plan: "professional" }),
    }));
    const englishProfessional = renderToStaticMarkup(await LoginPage({
      searchParams: Promise.resolve({ lang: "en", plan: "professional" }),
    }));

    expect(swedish).toContain("Företagsinloggning");
    expect(swedish).toContain("Logga in till Proffera");
    expect(swedish).toContain("Starta gratis i 14 dagar");
    expect(swedish).not.toContain("Business sign-in");

    expect(english).toContain("Business sign-in");
    expect(english).toContain("Sign in to Proffera");
    expect(english).toContain("Start a free 14-day trial");
    expect(english).not.toContain("Företagsinloggning");

    expect(swedishProfessional).toContain('href="/skapa-konto?plan=professional"');
    expect(englishProfessional).toContain('href="/en/create-account?plan=professional"');
  });

  it("returns locale-correct auth metadata at runtime", async () => {
    const loginSv = await loginMetadata({ searchParams: Promise.resolve({ lang: "sv" }) });
    const loginEn = await loginMetadata({ searchParams: Promise.resolve({ lang: "en" }) });
    const forgotSv = await forgotPasswordMetadata({ searchParams: Promise.resolve({ lang: "sv" }) });
    const forgotEn = await forgotPasswordMetadata({ searchParams: Promise.resolve({ lang: "en" }) });
    const resetSv = await resetPasswordMetadata({ searchParams: Promise.resolve({ lang: "sv" }) });
    const resetEn = await resetPasswordMetadata({ searchParams: Promise.resolve({ lang: "en" }) });
    const activationSv = await activationMetadata({
      params: Promise.resolve({ token: "token-123" }),
      searchParams: Promise.resolve({ lang: "sv" }),
    });
    const activationEn = await activationMetadata({
      params: Promise.resolve({ token: "token-123" }),
      searchParams: Promise.resolve({ lang: "en" }),
    });
    const invitationSv = await memberInvitationMetadata({
      params: Promise.resolve({ token: "token-123" }),
      searchParams: Promise.resolve({ lang: "sv" }),
    });
    const invitationEn = await memberInvitationMetadata({
      params: Promise.resolve({ token: "token-123" }),
      searchParams: Promise.resolve({ lang: "en" }),
    });

    expect(loginSv.title).toBe("Logga in");
    expect(loginEn.title).toBe("Sign in");
    expect(forgotSv.title).toBe("Glömt lösenord");
    expect(forgotEn.title).toBe("Reset password");
    expect(resetSv.title).toBe("Välj ett nytt lösenord");
    expect(resetEn.title).toBe("Choose a new password");
    expect(activationSv.title).toEqual({ absolute: "Aktivera arbetsyta | Proffera" });
    expect(activationEn.title).toEqual({ absolute: "Activate workspace | Proffera" });
    expect(invitationSv.title).toBe("Gå med i arbetsyta");
    expect(invitationEn.title).toBe("Join workspace");

    const metadataSources = [
      source("src/app/logga-in/page.tsx"),
      source("src/app/glomt-losenord/page.tsx"),
      source("src/app/aterstall-losenord/page.tsx"),
      source("src/app/aktivera/[token]/page.tsx"),
      source("src/app/bjud-in/[token]/page.tsx"),
    ];
    for (const page of metadataSources) {
      expect(page).toContain("generateMetadata");
    }
  });

  it("keeps password reset privacy and session-revocation messaging visible", () => {
    const requestPage = source("src/app/glomt-losenord/page.tsx");
    const resetPage = source("src/app/aterstall-losenord/page.tsx");

    expect(requestPage).toContain("Av säkerhetsskäl visar vi inte om adressen finns registrerad");
    expect(resetPage).toContain("tidigare Proffera-sessioner");
    expect(requestPage).toContain("auth-marketplace.module.css");
    expect(resetPage).toContain("auth-marketplace.module.css");
  });

  it("keeps password text clear of visibility controls", () => {
    const styles = source("src/components/auth/auth-marketplace.module.css");
    const login = source("src/app/logga-in/LoginForm.tsx");
    const activation = source("src/app/aktivera/[token]/activation-form.tsx");

    expect(styles).toContain(".input.passwordInput");
    expect(styles).toContain("padding-right: 72px");
    expect(login).toContain("authStyles.passwordInput");
    expect(activation).toContain("authStyles.passwordInput");
    expect(activation).not.toContain("pr-12");
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

    expect(activation).toContain('sv: {');
    expect(activation).toContain('en: {');
    expect(activation).toContain("applyActivationLocaleChange");
    expect(activation).toContain("authStyles.languageButton");
    expect(activationForm).toContain('name="lang"');
    expect(invite).toContain('sv: {');
    expect(invite).toContain('en: {');
    expect(invite).toContain("authStyles.languageLink");
    expect(invite).toContain("<ActivationForm");
  });
});


function memberInvitationForm(locale: "sv" | "en", password: string, confirmPassword: string) {
  const form = new FormData();
  form.set("lang", locale);
  form.set("password", password);
  form.set("confirm_password", confirmPassword);
  return form;
}

describe("member invitation redirect behavior", () => {
  beforeEach(() => {
    invitationRuntime.redirect.mockReset();
    invitationRuntime.claimWorkspaceMemberInvitation.mockReset();
    invitationRuntime.redirect.mockImplementation((target: string) => {
      throw new Error(`NEXT_REDIRECT:${target}`);
    });
  });

  it.each([
    ["sv", "/bjud-in/token-123?error=password"],
    ["en", "/bjud-in/token-123?lang=en&error=password"],
  ] as const)("keeps %s locale on password validation redirects", async (locale, expected) => {
    await expect(
      acceptMemberInvitationAction("token-123", memberInvitationForm(locale, "password1", "password2")),
    ).rejects.toThrow(`NEXT_REDIRECT:${expected}`);

    expect(invitationRuntime.claimWorkspaceMemberInvitation).not.toHaveBeenCalled();
  });

  it.each([
    ["sv", "/bjud-in/token-123?error=expired"],
    ["en", "/bjud-in/token-123?lang=en&error=expired"],
  ] as const)("keeps %s locale on claim failures", async (locale, expected) => {
    invitationRuntime.claimWorkspaceMemberInvitation.mockResolvedValue({ ok: false, code: "expired" });

    await expect(
      acceptMemberInvitationAction("token-123", memberInvitationForm(locale, "password1", "password1")),
    ).rejects.toThrow(`NEXT_REDIRECT:${expected}`);
  });

  it.each([
    ["sv", "/logga-in?created=1"],
    ["en", "/logga-in?lang=en&created=1"],
  ] as const)("keeps %s locale after successful invitation acceptance", async (locale, expected) => {
    invitationRuntime.claimWorkspaceMemberInvitation.mockResolvedValue({ ok: true });

    await expect(
      acceptMemberInvitationAction("token-123", memberInvitationForm(locale, "password1", "password1")),
    ).rejects.toThrow(`NEXT_REDIRECT:${expected}`);

    expect(invitationRuntime.claimWorkspaceMemberInvitation).toHaveBeenCalledWith("token-123", "password1");
  });
});
