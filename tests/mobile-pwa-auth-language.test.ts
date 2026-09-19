import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  pathname: "/dashboard/leads",
  search: "lang=en&campaign=spring&filter=open",
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({ href, children }: { href: unknown; children?: ReactNode }) => ReactModule.createElement(
      "a",
      { "data-test-href": String(href) },
      children,
    ),
  };
});

vi.mock("next/image", async () => {
  const ReactModule = await import("react");
  return {
    default: ({ alt, src }: { alt: string; src: string }) => ReactModule.createElement("img", { alt, src }),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(navigationState.search),
}));

vi.mock("@/app/dashboard/workspace-actions", () => ({
  switchWorkspaceAction: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));

import { ActivationForm } from "../src/app/aktivera/[token]/activation-form";
import { applyActivationLocaleChange } from "../src/app/aktivera/[token]/activation-view";
import {
  DashboardShell,
  handleMobileMenuKeydown,
  localizedHref,
  mobileLanguageLinkStyle,
} from "../src/components/dashboard/dashboard-shell";
import { AppShell } from "../src/components/layout/app-shell";
import { Header } from "../src/components/layout/header";
import {
  authLocaleHref,
  authRedirectHref,
  authRedirectQuery,
  resolveAuthLocale,
} from "../src/lib/auth-locale";
import {
  isAuthQueryLocalePath,
  isAuthSurfacePath,
  resolvePublicRequestLocale,
} from "../src/lib/public-locale";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function focusableElement() {
  return {
    focus: vi.fn(),
    getAttribute: vi.fn(() => null),
    hasAttribute: vi.fn(() => false),
  };
}

describe("mobile PWA and auth language contract", () => {
  it("keeps viewport-fit cover and renders top safe-area padding", () => {
    expect(source("src/app/layout.tsx")).toContain('viewportFit: "cover"');

    navigationState.pathname = "/dashboard/leads";
    navigationState.search = "lang=en&campaign=spring&filter=open";

    const publicHeader = renderToStaticMarkup(React.createElement(Header, { locale: "en" }));
    const dashboard = renderToStaticMarkup(React.createElement(
      DashboardShell,
      null,
      React.createElement("div", null, "Dashboard content"),
    ));

    expect(publicHeader).toContain("padding-top:calc(0.75rem + env(safe-area-inset-top))");
    expect(dashboard).toContain("padding-top:calc(0.75rem + env(safe-area-inset-top))");
  });

  it("resolves query-localized auth routes without changing normal route locale semantics", () => {
    expect(isAuthQueryLocalePath("/logga-in")).toBe(true);
    expect(isAuthQueryLocalePath("/aktivera/token-123")).toBe(true);
    expect(isAuthSurfacePath("/en/create-account")).toBe(true);
    expect(resolvePublicRequestLocale("/logga-in", "en")).toBe("en");
    expect(resolvePublicRequestLocale("/logga-in", "sv")).toBe("sv");
    expect(resolvePublicRequestLocale("/en/demo", null)).toBe("en");
    expect(resolvePublicRequestLocale("/demo", "en")).toBe("sv");
  });

  it("uses the current marketplace header and English footer on English auth surfaces", () => {
    navigationState.pathname = "/logga-in";
    navigationState.search = "lang=en";

    const shell = renderToStaticMarkup(React.createElement(
      AppShell,
      {
        localeHint: "en",
        children: React.createElement("div", null, "Auth content"),
      },
    ));

    expect(shell).toContain("Find businesses");
    expect(shell).toContain("Popular services");
    expect(shell).toContain("For businesses");
    expect(shell).toContain("All rights reserved.");
    expect(shell).not.toContain(">Features<");
    expect(shell).not.toContain(">Funktioner<");
  });

  it("preserves unrelated auth query params while changing only locale", () => {
    const params = {
      created: "1",
      plan: "pro",
      next: "/foretag/claim/acme-ab",
      campaign: ["spring", "partner"],
      lang: "sv",
    };

    const href = authLocaleHref("/logga-in", params, "en");
    const query = new URL(href, "https://proffera.se").searchParams;

    expect(query.get("lang")).toBe("en");
    expect(query.get("created")).toBe("1");
    expect(query.get("plan")).toBe("pro");
    expect(query.get("next")).toBe("/foretag/claim/acme-ab");
    expect(query.getAll("campaign")).toEqual(["spring", "partner"]);
    expect(resolveAuthLocale(params)).toBe("sv");
  });

  it("preserves activation context across validation errors and successful login redirects", () => {
    const redirectQuery = authRedirectQuery({
      lang: "en",
      plan: "pro",
      campaign: "launch",
      error: "expired",
    }, ["error"]);

    const errorHref = authRedirectHref("/aktivera/token-123", redirectQuery, "en", { error: "password" });
    const successHref = authRedirectHref("/logga-in", redirectQuery, "en", { error: null, created: "1" });

    const errorUrl = new URL(errorHref, "https://proffera.se");
    expect(errorUrl.pathname).toBe("/aktivera/token-123");
    expect(errorUrl.searchParams.get("lang")).toBe("en");
    expect(errorUrl.searchParams.get("plan")).toBe("pro");
    expect(errorUrl.searchParams.get("campaign")).toBe("launch");
    expect(errorUrl.searchParams.get("error")).toBe("password");

    const successUrl = new URL(successHref, "https://proffera.se");
    expect(successUrl.pathname).toBe("/logga-in");
    expect(successUrl.searchParams.get("lang")).toBe("en");
    expect(successUrl.searchParams.get("plan")).toBe("pro");
    expect(successUrl.searchParams.get("campaign")).toBe("launch");
    expect(successUrl.searchParams.get("created")).toBe("1");
    expect(successUrl.searchParams.has("error")).toBe(false);
  });

  it("removes stale activation errors while changing locale and keeps password inputs uncontrolled", () => {
    const replacements: string[] = [];
    const redirectQuery = applyActivationLocaleChange(
      "?lang=sv&plan=pro&campaign=launch&error=expired",
      "/aktivera/token-123",
      "en",
      (href) => replacements.push(href),
    );

    expect(replacements).toEqual([
      "/aktivera/token-123?lang=en&plan=pro&campaign=launch",
    ]);

    const redirectParams = new URLSearchParams(redirectQuery);
    expect(redirectParams.get("lang")).toBe("en");
    expect(redirectParams.get("plan")).toBe("pro");
    expect(redirectParams.get("campaign")).toBe("launch");
    expect(redirectParams.has("error")).toBe(false);

    const form = renderToStaticMarkup(React.createElement(ActivationForm, {
      action: async () => undefined,
      locale: "en",
      redirectQuery,
    }));

    expect(form).toContain('name="lang" value="en"');
    expect(form).toContain('name="redirect_query" value="lang=en&amp;plan=pro&amp;campaign=launch"');
    expect(form).toMatch(/<input(?=[^>]*\btype="password")(?=[^>]*\bname="password")[^>]*>/);
    expect(form).toMatch(/<input(?=[^>]*\btype="password")(?=[^>]*\bname="confirm_password")[^>]*>/);
    expect(form).not.toMatch(/name="password"[^>]*value=/);
    expect(form).not.toMatch(/name="confirm_password"[^>]*value=/);
    expect(form).toContain("Activate customer portal");
  });

  it("keeps the mobile language switch readable in WebKit", () => {
    expect(mobileLanguageLinkStyle).toEqual({
      color: "#ffffff",
      WebkitTextFillColor: "#ffffff",
    });

    expect(source("src/components/dashboard/dashboard-shell.tsx")).toContain(
      'style={mobileLanguageLinkStyle}>{text.language}</Link>',
    );
  });

  it("preserves dashboard query context when switching language", () => {
    expect(localizedHref(
      "/dashboard/leads",
      "sv",
      "lang=en&campaign=spring&filter=open",
    )).toBe("/dashboard/leads?campaign=spring&filter=open");

    expect(localizedHref(
      "/dashboard/leads",
      "en",
      "campaign=spring&filter=open",
    )).toBe("/dashboard/leads?campaign=spring&filter=open&lang=en");

    navigationState.pathname = "/dashboard/leads";
    navigationState.search = "lang=en&campaign=spring&filter=open";
    const dashboard = renderToStaticMarkup(React.createElement(
      DashboardShell,
      null,
      React.createElement("div", null, "Dashboard content"),
    ));

    expect(dashboard).toContain('data-test-href="/dashboard/leads?campaign=spring&amp;filter=open"');
  });

  it("traps mobile-menu tab focus and closes on Escape", () => {
    const first = focusableElement();
    const last = focusableElement();
    const panelFocus = vi.fn();
    const panel = {
      querySelectorAll: vi.fn(() => [first, last]),
      contains: vi.fn((element: unknown) => element === first || element === last),
      focus: panelFocus,
    } as unknown as HTMLElement;

    const forwardEvent = { key: "Tab", shiftKey: false, preventDefault: vi.fn() };
    handleMobileMenuKeydown(forwardEvent, panel, last as unknown as Element, vi.fn());
    expect(forwardEvent.preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();

    const backwardEvent = { key: "Tab", shiftKey: true, preventDefault: vi.fn() };
    handleMobileMenuKeydown(backwardEvent, panel, first as unknown as Element, vi.fn());
    expect(backwardEvent.preventDefault).toHaveBeenCalledOnce();
    expect(last.focus).toHaveBeenCalledOnce();

    const close = vi.fn();
    const escapeEvent = { key: "Escape", shiftKey: false, preventDefault: vi.fn() };
    handleMobileMenuKeydown(escapeEvent, panel, first as unknown as Element, close);
    expect(escapeEvent.preventDefault).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(panelFocus).not.toHaveBeenCalled();
  });
});
