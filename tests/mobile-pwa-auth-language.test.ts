import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  authLocaleHref,
  authRedirectHref,
  authRedirectQuery,
  resolveAuthLocale,
} from "../src/lib/auth-locale";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("mobile PWA and auth language contract", () => {
  it("keeps viewport-fit cover and applies top safe-area padding to public and dashboard headers", () => {
    const rootLayout = source("src/app/layout.tsx");
    const publicHeader = source("src/components/layout/header.tsx");
    const dashboardShell = source("src/components/dashboard/dashboard-shell.tsx");

    expect(rootLayout).toContain('viewportFit: "cover"');
    expect(publicHeader).toContain("env(safe-area-inset-top)");
    expect(dashboardShell).toContain("env(safe-area-inset-top)");
    expect(dashboardShell).toContain("calc(1.25rem + env(safe-area-inset-top))");
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

  it("keeps activation bilingual without navigation-driven form resets", () => {
    const page = source("src/app/aktivera/[token]/page.tsx");
    const view = source("src/app/aktivera/[token]/activation-view.tsx");
    const form = source("src/app/aktivera/[token]/activation-form.tsx");
    const actions = source("src/app/aktivera/[token]/actions.ts");

    expect(page).toContain("resolveAuthLocale");
    expect(page).toContain("ActivationView");
    expect(view).toContain('window.history.replaceState');
    expect(view).toContain('current.set("lang", nextLocale)');
    expect(view).toContain('current.delete("error")');
    expect(view).toContain('Activate customer portal');
    expect(view).toContain('Välj ditt lösenord');
    expect(form).toContain('name="lang"');
    expect(form).toContain('name="redirect_query"');
    expect(form).toContain('Show password');
    expect(form).toContain('Visa lösenord');
    expect(actions).toContain('authRedirectHref(activationPath');
    expect(actions).toContain('authRedirectHref("/logga-in"');
  });

  it("keeps dashboard language switching in the mobile drawer and preserves query context", () => {
    const dashboardShell = source("src/components/dashboard/dashboard-shell.tsx");
    const loginPage = source("src/app/logga-in/page.tsx");

    expect(dashboardShell).toContain("const searchParamsString = searchParams.toString()");
    expect(dashboardShell).toContain("new URLSearchParams(currentSearch)");
    expect(dashboardShell).toContain("searchParams={searchParamsString}");
    expect(dashboardShell).toContain("const languageHref = localizedHref(pathname");
    expect(dashboardShell).toContain('onClick={() => setIsMobileMenuOpen(false)} className="mt-4 flex min-h-11');
    expect(loginPage).toContain('authLocaleHref("/logga-in", params, "sv")');
    expect(loginPage).toContain('authLocaleHref("/logga-in", params, "en")');
  });
});
