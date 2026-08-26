import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../src/lib/public-site-domain-routing", () => ({
  resolvePublicCustomDomain: vi.fn(async () => null),
}));

import { proxy } from "../src/proxy";

function request(path: string, headers?: HeadersInit) {
  return new NextRequest(`https://www.proffera.se${path}`, { headers });
}

describe("proxy request boundary", () => {
  it("passes the exact admin path to session and role authorization", async () => {
    const response = await proxy(request("/admin/billing/alerts"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-request-x-proffera-admin-path")).toBe("/admin/billing/alerts");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("www-authenticate")).toBeNull();
  });

  it("fails closed unknown admin route families before document or RSC rendering", async () => {
    const documentResponse = await proxy(request("/admin/unknown"));
    const rscResponse = await proxy(request("/admin/unknown", {
      RSC: "1",
      "Next-Router-State-Tree": "%5B%22%22%5D",
    }));

    for (const response of [documentResponse, rscResponse]) {
      expect(response.status).toBe(404);
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(response.headers.get("x-middleware-next")).toBeNull();
    }
  });

  it("allows mapped admin RSC navigation and preserves the exact authorization path", async () => {
    const response = await proxy(request("/admin/support/session-123", {
      RSC: "1",
      "Next-Router-State-Tree": "%5B%22%22%5D",
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-request-x-proffera-admin-path")).toBe("/admin/support/session-123");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("does not require a shared Basic Auth secret before route-level Platform Admin authorization", async () => {
    const response = await proxy(request("/api/outbox"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("www-authenticate")).toBeNull();
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
