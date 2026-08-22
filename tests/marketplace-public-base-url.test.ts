import { afterEach, describe, expect, it } from "vitest";

import { resolveMarketplacePublicBaseUrl } from "@/lib/marketplace-public-base-url";

const original = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_URL: process.env.VERCEL_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_URL: process.env.APP_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("marketplace public base URL", () => {
  it("prefers the trusted Vercel preview hostname in preview deployments", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "proffera-git-preview.vercel.app";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.proffera.se";

    expect(resolveMarketplacePublicBaseUrl()).toBe("https://proffera-git-preview.vercel.app");
  });

  it("uses the configured HTTPS application origin outside preview", () => {
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.proffera.se/path?ignored=yes";

    expect(resolveMarketplacePublicBaseUrl()).toBe("https://app.proffera.se");
  });

  it("rejects insecure remote origins and falls back to production", () => {
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
    process.env.NEXT_PUBLIC_APP_URL = "http://evil.example/customer-token";
    delete process.env.APP_URL;

    expect(resolveMarketplacePublicBaseUrl()).toBe("https://www.proffera.se");
  });
});
