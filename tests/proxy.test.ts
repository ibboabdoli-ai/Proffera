import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../src/lib/public-site-domain-routing", () => ({
  resolvePublicCustomDomain: vi.fn(async () => null),
}));

import { proxy } from "../src/proxy";

const originalAdminAccessCode = process.env.ADMIN_ACCESS_CODE;

function request(path: string, headers?: HeadersInit) {
  return new NextRequest(`https://www.proffera.se${path}`, { headers });
}

afterEach(() => {
  if (originalAdminAccessCode === undefined) {
    delete process.env.ADMIN_ACCESS_CODE;
  } else {
    process.env.ADMIN_ACCESS_CODE = originalAdminAccessCode;
  }
});

describe("proxy request boundary", () => {
  it("allows admin pages to reach session and role authorization", async () => {
    process.env.ADMIN_ACCESS_CODE = "test-admin-code";

    const response = await proxy(request("/admin/saas"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("www-authenticate")).toBeNull();
  });

  it("rejects unauthenticated sensitive admin API requests", async () => {
    process.env.ADMIN_ACCESS_CODE = "test-admin-code";

    const response = await proxy(request("/api/outbox"));

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Proffera Admin");
  });

  it("allows valid Basic authentication for sensitive admin APIs", async () => {
    process.env.ADMIN_ACCESS_CODE = "test-admin-code";
    const authorization = `Basic ${btoa("admin:test-admin-code")}`;

    const response = await proxy(
      request("/api/company-admin", {
        authorization,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("marks dashboard responses as noindex", async () => {
    const response = await proxy(request("/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("redirects chat app routes and preserves query parameters", async () => {
    const response = await proxy(request("/app/inbox?conversation=123"));
    const location = response.headers.get("location");

    expect(response.status).toBe(307);
    expect(location).toBe(
      "https://chat.proffera.se/app/inbox?conversation=123&tenant=proffera",
    );
  });

  it("rewrites the PrimeView root without changing the customer-facing URL", async () => {
    const response = await proxy(
      new NextRequest("https://primeviewwindowcare.co.uk/", {
        headers: { host: "primeviewwindowcare.co.uk" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://primeviewwindowcare.co.uk/demo/primeview",
    );
  });

  it("forwards the English locale for English public routes", async () => {
    const response = await proxy(request("/en/pricing"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-proffera-locale")).toBe("en");
  });
});
