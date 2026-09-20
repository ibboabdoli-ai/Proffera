import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../src/lib/public-site-domain-routing", () => ({
  resolvePublicCustomDomain: vi.fn(async () => null),
}));

import { resolvePublicCustomDomain } from "../src/lib/public-site-domain-routing";
import { proxy } from "../src/proxy";

const resolvePublicCustomDomainMock = vi.mocked(resolvePublicCustomDomain);
const requestId = "123e4567-e89b-42d3-a456-426614174000";

function request(path: string, headers?: HeadersInit) {
  return new NextRequest(`https://www.proffera.se${path}`, { headers });
}

function hostRequest(host: string, path: string, headers: HeadersInit = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("host", host);
  return new NextRequest(`https://${host}${path}`, {
    headers: requestHeaders,
  });
}

describe("proxy request boundary", () => {
  beforeEach(() => {
    resolvePublicCustomDomainMock.mockReset();
    resolvePublicCustomDomainMock.mockResolvedValue(null);
  });
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

  it("rewrites the PrimeView booking alias while blocking its internal route directly", async () => {
    const booking = await proxy(hostRequest("www.primeviewwindowcare.co.uk", "/booking"));
    const internal = await proxy(hostRequest("www.primeviewwindowcare.co.uk", "/primeview-booking"));

    expect(booking.status).toBe(200);
    expect(booking.headers.get("x-middleware-rewrite")).toBe(
      "https://www.primeviewwindowcare.co.uk/primeview-booking",
    );
    expect(internal.status).toBe(404);
    expect(internal.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("fails closed when PrimeView-only routes are requested on the platform host", async () => {
    for (const path of ["/services", "/services/window-cleaning", "/areas/ealing", "/gallery", "/gallery/", "/privacy", "/booking", "/boka/primeview", "/primeview-booking"]) {
      const response = await proxy(hostRequest("www.proffera.se", path));
      expect(response.status, path).toBe(404);
      expect(response.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
    }
  });

  it("fails closed when platform namespaces are requested on the PrimeView host", async () => {
    for (const path of ["/priser", "/skapa-konto", "/en/pricing", "/tjanster", "/dashboard", "/admin", "/demo"]) {
      const response = await proxy(hostRequest("www.primeviewwindowcare.co.uk", path));
      expect(response.status, path).toBe(404);
      expect(response.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
    }

    const services = await proxy(hostRequest("www.primeviewwindowcare.co.uk", "/services/window-cleaning"));
    expect(services.status).toBe(200);
    expect(services.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps generic custom domains fail-closed outside root, services and shared customer flows", async () => {
    for (const path of ["/priser", "/en/pricing", "/dashboard", "/admin", "/services", "/areas/ealing", "/gallery", "/gallery/", "/privacy", "/booking", "/boka/primeview"]) {
      const response = await proxy(hostRequest("customer.example.com", path));
      expect(response.status, path).toBe(404);
      expect(response.headers.get("x-robots-tag"), path).toBe("noindex, nofollow");
    }

    for (const path of ["/boka/acme", "/mina-bokningar/token", "/offert/token", "/review/token", "/gallery/acme"]) {
      const response = await proxy(hostRequest("customer.example.com", path));
      expect(response.status, path).toBe(200);
      expect(response.headers.get("x-middleware-next"), path).toBe("1");
    }
  });

  it("preserves generic custom-domain root and clean service rewrites", async () => {
    resolvePublicCustomDomainMock.mockResolvedValue({
      workspaceId: "11111111-1111-4111-8111-111111111111",
      workspaceSlug: "acme",
      bookingSlug: "acme-booking",
      publicHomeMode: "website",
    });

    const root = await proxy(hostRequest("customer.example.com", "/"));
    const service = await proxy(hostRequest("customer.example.com", "/tjanster/window-cleaning"));

    expect(root.status).toBe(200);
    expect(root.headers.get("x-middleware-rewrite")).toBe(
      "https://customer.example.com/foretag/acme",
    );
    expect(service.status).toBe(200);
    expect(service.headers.get("x-middleware-rewrite")).toBe(
      "https://customer.example.com/foretag/acme/tjanster/window-cleaning",
    );
  });

  it("keeps the platform root on the platform host", async () => {
    const response = await proxy(hostRequest("www.proffera.se", "/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("preserves a valid request ID on an unresolved custom-domain 404", async () => {
    const response = await proxy(hostRequest("customer.example.com", "/", {
      "x-proffera-request-id": requestId,
    }));

    expect(resolvePublicCustomDomainMock).toHaveBeenCalledWith("customer.example.com");
    expect(response.status).toBe(404);
    expect(response.headers.get("x-proffera-request-id")).toBe(requestId);
  });

  it("propagates the request ID to both downstream request headers and the response", async () => {
    const response = await proxy(request("/en/pricing", {
      "x-proffera-request-id": requestId,
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-proffera-request-id")).toBe(requestId);
    expect(response.headers.get("x-middleware-request-x-proffera-request-id")).toBe(requestId);
  });

  it("replaces an invalid incoming request ID before forwarding it", async () => {
    const response = await proxy(request("/", {
      "x-proffera-request-id": "attacker-controlled",
    }));

    const generated = response.headers.get("x-proffera-request-id");
    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(generated).not.toBe("attacker-controlled");
    expect(response.headers.get("x-middleware-request-x-proffera-request-id")).toBe(generated);
  });

  it("forwards the English locale for English public routes", async () => {
    const response = await proxy(request("/en/pricing"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-proffera-locale")).toBe("en");
  });
});
