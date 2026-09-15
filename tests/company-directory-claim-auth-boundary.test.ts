import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasBetterAuthSessionCookie: vi.fn(),
  getServerSession: vi.fn(),
  getPublicDirectoryBusiness: vi.fn(),
  getSql: vi.fn(),
  parseClaimEmailEvidence: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  loginForm: vi.fn(),
  isCheckoutPlanKey: vi.fn(),
  resolveOwnerPostLoginPath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}));
vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({ href, children }: { href: unknown; children?: ReactNode }) =>
      ReactModule.createElement("a", { href: String(href) }, children),
  };
});
vi.mock("@/lib/auth-session", () => ({
  hasBetterAuthSessionCookie: mocks.hasBetterAuthSessionCookie,
  getServerSession: mocks.getServerSession,
}));
vi.mock("@/lib/company-directory-engine", () => ({
  getPublicDirectoryBusiness: mocks.getPublicDirectoryBusiness,
}));
vi.mock("@/lib/db/server", () => ({
  getSql: mocks.getSql,
}));
vi.mock("@/lib/company-directory-claim-email", () => ({
  parseClaimEmailEvidence: mocks.parseClaimEmailEvidence,
}));
vi.mock("@/lib/billing-plans", () => ({
  isCheckoutPlanKey: mocks.isCheckoutPlanKey,
}));
vi.mock("@/lib/owner-onboarding-routing", () => ({
  resolveOwnerPostLoginPath: mocks.resolveOwnerPostLoginPath,
}));
vi.mock("../src/app/logga-in/LoginForm", async () => {
  const ReactModule = await import("react");
  return {
    LoginForm: (props: { afterLoginPath: string; locale: "sv" | "en" }) => {
      mocks.loginForm(props);
      return ReactModule.createElement("div", {
        "data-after-login": props.afterLoginPath,
        "data-locale": props.locale,
      });
    },
  };
});

import EnglishClaimCompanyPage from "../src/app/en/companies/claim/[slug]/page";
import ClaimCompanyPage from "../src/app/foretag/claim/[slug]/page";
import LoginPage from "../src/app/logga-in/page";
import { resolveSafeClaimLoginNext } from "../src/lib/claim-login-return";

const CLAIM_SLUG = "acme-service-ab-123456";
const SWEDISH_CLAIM_PATH = `/foretag/claim/${CLAIM_SLUG}`;
const ENGLISH_CLAIM_PATH = `/en/companies/claim/${CLAIM_SLUG}`;

type ClaimPage = (props: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) => Promise<unknown>;

function redirectError(destination: string) {
  return new Error(`NEXT_REDIRECT:${destination}`);
}

async function expectAnonymousRedirect(page: ClaimPage, expectedDestination: string) {
  mocks.hasBetterAuthSessionCookie.mockResolvedValue(false);

  await expect(page({
    params: Promise.resolve({ slug: CLAIM_SLUG }),
    searchParams: Promise.resolve({}),
  })).rejects.toThrow(`NEXT_REDIRECT:${expectedDestination}`);

  expect(mocks.redirect).toHaveBeenCalledWith(expectedDestination);
  expect(mocks.getServerSession).not.toHaveBeenCalled();
  expect(mocks.getPublicDirectoryBusiness).not.toHaveBeenCalled();
  expect(mocks.getSql).not.toHaveBeenCalled();
}

async function expectStaleCookieRedirect(page: ClaimPage, expectedDestination: string) {
  mocks.hasBetterAuthSessionCookie.mockResolvedValue(true);
  mocks.getServerSession.mockResolvedValue(null);

  await expect(page({
    params: Promise.resolve({ slug: CLAIM_SLUG }),
    searchParams: Promise.resolve({}),
  })).rejects.toThrow(`NEXT_REDIRECT:${expectedDestination}`);

  expect(mocks.hasBetterAuthSessionCookie).toHaveBeenCalledOnce();
  expect(mocks.getServerSession).toHaveBeenCalledOnce();
  expect(mocks.redirect).toHaveBeenCalledWith(expectedDestination);
  expect(mocks.getPublicDirectoryBusiness).not.toHaveBeenCalled();
  expect(mocks.getSql).not.toHaveBeenCalled();
}

async function expectValidSessionProceeds(page: ClaimPage) {
  mocks.hasBetterAuthSessionCookie.mockResolvedValue(true);
  mocks.getServerSession.mockResolvedValue({
    user: {
      id: "user-1",
      name: "Test User",
      email: "user@example.test",
    },
  });
  mocks.getPublicDirectoryBusiness.mockResolvedValue({
    slug: CLAIM_SLUG,
    companyName: "Acme Service AB",
  });
  mocks.getSql.mockReturnValue(null);

  await expect(page({
    params: Promise.resolve({ slug: CLAIM_SLUG }),
    searchParams: Promise.resolve({}),
  })).resolves.toBeTruthy();

  expect(mocks.getPublicDirectoryBusiness).toHaveBeenCalledWith(CLAIM_SLUG);
  expect(mocks.getSql).toHaveBeenCalledOnce();
  expect(mocks.getServerSession.mock.invocationCallOrder[0])
    .toBeLessThan(mocks.getPublicDirectoryBusiness.mock.invocationCallOrder[0]);
  expect(mocks.getPublicDirectoryBusiness.mock.invocationCallOrder[0])
    .toBeLessThan(mocks.getSql.mock.invocationCallOrder[0]);
}

describe("Company Directory claim auth boundary", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();

    mocks.redirect.mockImplementation((destination: string) => {
      throw redirectError(destination);
    });
    mocks.notFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    mocks.parseClaimEmailEvidence.mockReturnValue(null);
    mocks.isCheckoutPlanKey.mockReturnValue(false);
    mocks.resolveOwnerPostLoginPath.mockReturnValue("/dashboard");
  });

  it("accepts only local Company Directory claim return paths", () => {
    expect(resolveSafeClaimLoginNext(SWEDISH_CLAIM_PATH)).toBe(SWEDISH_CLAIM_PATH);
    expect(resolveSafeClaimLoginNext(`${SWEDISH_CLAIM_PATH}?lang=en`)).toBe(
      `${SWEDISH_CLAIM_PATH}?lang=en`,
    );
    expect(resolveSafeClaimLoginNext(ENGLISH_CLAIM_PATH)).toBe(ENGLISH_CLAIM_PATH);
  });

  it("rejects external, ambiguous, fragmented, or unrelated return paths", () => {
    const rejected = [
      `https://evil.example${SWEDISH_CLAIM_PATH}`,
      `//evil.example${SWEDISH_CLAIM_PATH}`,
      "/dashboard",
      `${SWEDISH_CLAIM_PATH}#token`,
      `${SWEDISH_CLAIM_PATH}?status=sent`,
      `${SWEDISH_CLAIM_PATH}?lang=sv`,
      `${SWEDISH_CLAIM_PATH}?lang=en&status=sent`,
      `${ENGLISH_CLAIM_PATH}?lang=en`,
      "/foretag/claim/%2e%2e",
    ];

    for (const value of rejected) {
      expect(resolveSafeClaimLoginNext(value)).toBeNull();
    }

    expect(resolveSafeClaimLoginNext([SWEDISH_CLAIM_PATH, ENGLISH_CLAIM_PATH])).toBeNull();
  });

  it("redirects anonymous Swedish claim requests before auth or Directory reads", async () => {
    const expected = `/logga-in?next=${encodeURIComponent(SWEDISH_CLAIM_PATH)}`;
    await expectAnonymousRedirect(ClaimCompanyPage as ClaimPage, expected);
  });

  it("redirects anonymous English claim requests before auth or Directory reads", async () => {
    const expected = `/logga-in?lang=en&next=${encodeURIComponent(ENGLISH_CLAIM_PATH)}`;
    await expectAnonymousRedirect(EnglishClaimCompanyPage as ClaimPage, expected);
  });

  it("fails a stale Swedish session cookie closed before Directory reads", async () => {
    const expected = `/logga-in?next=${encodeURIComponent(SWEDISH_CLAIM_PATH)}`;
    await expectStaleCookieRedirect(ClaimCompanyPage as ClaimPage, expected);
  });

  it("fails a stale English session cookie closed before Directory reads", async () => {
    const expected = `/logga-in?lang=en&next=${encodeURIComponent(ENGLISH_CLAIM_PATH)}`;
    await expectStaleCookieRedirect(EnglishClaimCompanyPage as ClaimPage, expected);
  });

  it("loads Directory data only after a valid Swedish session", async () => {
    await expectValidSessionProceeds(ClaimCompanyPage as ClaimPage);
  });

  it("loads Directory data only after a valid English session", async () => {
    await expectValidSessionProceeds(EnglishClaimCompanyPage as ClaimPage);
  });

  it("passes a validated claim next to LoginForm and preserves it across language links", async () => {
    const nextValue = `${SWEDISH_CLAIM_PATH}?lang=en`;
    const element = await LoginPage({
      searchParams: Promise.resolve({
        lang: "en",
        next: nextValue,
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(mocks.loginForm).toHaveBeenCalledWith({
      afterLoginPath: nextValue,
      locale: "en",
    });

    const encodedNext = encodeURIComponent(nextValue);
    expect(html).toContain(
      `href="/logga-in?lang=sv&amp;next=${encodedNext}"`,
    );
    expect(html).toContain(
      `href="/logga-in?lang=en&amp;next=${encodedNext}"`,
    );
  });

  it("falls back to the existing owner route when next is unsafe", async () => {
    const element = await LoginPage({
      searchParams: Promise.resolve({
        lang: "sv",
        next: "https://evil.example/foretag/claim/acme-service-ab-123456",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(mocks.resolveOwnerPostLoginPath).toHaveBeenCalledWith({
      locale: "sv",
      accountCreated: false,
      selectedPlan: null,
    });
    expect(mocks.loginForm).toHaveBeenCalledWith({
      afterLoginPath: "/dashboard",
      locale: "sv",
    });
    expect(html).not.toContain("evil.example");
  });
});
