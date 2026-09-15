import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveSafeClaimLoginNext } from "../src/lib/claim-login-return";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function functionBody(code: string, marker: string) {
  const start = code.indexOf(marker);
  expect(start).toBeGreaterThanOrEqual(0);
  return code.slice(start);
}

function expectClaimAuthOrdering(path: string, marker: string) {
  const body = functionBody(source(path), marker);
  const cookieGate = body.indexOf("await hasBetterAuthSessionCookie()");
  const realSession = body.indexOf("await getServerSession()");
  const directoryRead = body.indexOf("await getPublicDirectoryBusiness(slug)");
  const claimRead = body.indexOf("getSql()");

  expect(cookieGate).toBeGreaterThanOrEqual(0);
  expect(realSession).toBeGreaterThan(cookieGate);
  expect(directoryRead).toBeGreaterThan(realSession);
  expect(claimRead).toBeGreaterThan(directoryRead);

  const beforeRealSession = body.slice(cookieGate, realSession);
  expect(beforeRealSession).toContain("redirect(loginHref)");

  const beforeDirectoryRead = body.slice(realSession, directoryRead);
  expect(beforeDirectoryRead).toContain("if (!session?.user?.id)");
  expect(beforeDirectoryRead).toContain("redirect(loginHref)");
  expect(body).not.toContain("Promise.all([");
}

describe("Company Directory claim auth boundary", () => {
  it("accepts only local Company Directory claim return paths", () => {
    expect(resolveSafeClaimLoginNext("/foretag/claim/acme-service-ab-123456")).toBe(
      "/foretag/claim/acme-service-ab-123456",
    );
    expect(resolveSafeClaimLoginNext("/foretag/claim/acme-service-ab-123456?lang=en")).toBe(
      "/foretag/claim/acme-service-ab-123456?lang=en",
    );
    expect(resolveSafeClaimLoginNext("/en/companies/claim/acme-service-ab-123456")).toBe(
      "/en/companies/claim/acme-service-ab-123456",
    );
  });

  it("rejects external, ambiguous, fragmented, or unrelated return paths", () => {
    const rejected = [
      "https://evil.example/foretag/claim/acme-service-ab-123456",
      "//evil.example/foretag/claim/acme-service-ab-123456",
      "/dashboard",
      "/foretag/claim/acme-service-ab-123456#token",
      "/foretag/claim/acme-service-ab-123456?status=sent",
      "/foretag/claim/acme-service-ab-123456?lang=sv",
      "/foretag/claim/acme-service-ab-123456?lang=en&status=sent",
      "/en/companies/claim/acme-service-ab-123456?lang=en",
      "/foretag/claim/%2e%2e",
    ];

    for (const value of rejected) {
      expect(resolveSafeClaimLoginNext(value)).toBeNull();
    }

    expect(resolveSafeClaimLoginNext([
      "/foretag/claim/acme-service-ab-123456",
      "/en/companies/claim/acme-service-ab-123456",
    ])).toBeNull();
  });

  it("keeps the cookie-presence check independent from real auth initialization", () => {
    const code = source("src/lib/auth-session.ts");
    const cookieHelperStart = code.indexOf("export async function hasBetterAuthSessionCookie");
    const realSessionStart = code.indexOf("export async function getServerSession");
    const cookieHelper = code.slice(cookieHelperStart, realSessionStart);

    expect(cookieHelper).toContain("getSessionCookie(request)");
    expect(cookieHelper).not.toContain("getAuth()");
  });

  it("redirects anonymous and stale-cookie claim requests before Directory reads", () => {
    expectClaimAuthOrdering(
      "src/app/foretag/claim/[slug]/page.tsx",
      "export default async function ClaimCompanyPage",
    );
    expectClaimAuthOrdering(
      "src/app/en/companies/claim/[slug]/page.tsx",
      "export default async function EnglishClaimCompanyPage",
    );
  });

  it("preserves a validated claim return path through login and language switching", () => {
    const code = source("src/app/logga-in/page.tsx");

    expect(code).toContain("resolveSafeClaimLoginNext(params?.next)");
    expect(code).toContain('if (nextValue) params.set("next", nextValue)');
    expect(code).toContain("const afterLoginPath = nextValue ?? resolveOwnerPostLoginPath({");
    expect(code).toContain('languageHref("sv", createdValue, planValue, resetValue, nextValue)');
    expect(code).toContain('languageHref("en", createdValue, planValue, resetValue, nextValue)');
  });
});
