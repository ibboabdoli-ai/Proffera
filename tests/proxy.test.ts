import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { MARIA_PAYMENT_SHELL_HEADER } from "../src/lib/maria-payment-standalone";

vi.mock("../src/lib/public-site-domain-routing", () => ({
  resolvePublicCustomDomain: vi.fn(async () => null),
}));

import { resolvePublicCustomDomain } from "../src/lib/public-site-domain-routing";
import { config, proxy } from "../src/proxy";

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

  afterEach(() => vi.unstubAllEnvs());

  it("removes a forged standalone payment marker on unrelated routes", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const forged = { [MARIA_PAYMENT_SHELL_HEADER]: "1" };
    const forwarded = "x-middleware-request-" + MARIA_PAYMENT_SHELL_HEADER;
    for (const path of [
      "/dashboard",
      "/en/pricing",
      "/maria/swish/not-a-uuid",
      // A valid booking UUID with a descendant must never activate the payment shell.
      "/maria/swish/3dd71085-9f11-49d1-8996-663e3135d115/extra",
    ]) {
      const response = await proxy(request(path, forged));
      expect(response.status, path).toBe(200);
      expect(response.headers.get(forwarded), path).toBeNull();
      expect(response.headers.get("x-middleware-override-headers")?.split(","), path)
        .not.toContain(MARIA_PAYMENT_SHELL_HEADER);
    }
  });

  it("adds the payment shell marker only for an exact Swish booking in Preview", async () => {
    const validPath = "/maria/swish/3dd71085-9f11-49d1-8996-663e3135d115";
    const forwarded = "x-middleware-request-" + MARIA_PAYMENT_SHELL_HEADER;
    vi.stubEnv("VERCEL_ENV", "preview");
    const preview = await proxy(request(validPath));
    expect(preview.status).toBe(200);
    expect(preview.headers.get(forwarded)).toBe("1");

    vi.stubEnv("VERCEL_ENV", "production");
    const production = await proxy(request(validPath, {
      [MARIA_PAYMENT_SHELL_HEADER]: "1",
    }));
    expect(production.status).toBe(200);
    expect(production.headers.get(forwarded)).toBeNull();

    // Production standalone styling is granted only to the Maria branded host.
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    const maria = await proxy(hostRequest("makeupbymaria.se", validPath, {
      [MARIA_PAYMENT_SHELL_HEADER]: "forged",
    }));
    expect(maria.status).toBe(200);
    expect(maria.headers.get(forwarded)).toBe("1");

    const unrelated = await proxy(hostRequest("primeviewwindowcare.co.uk", validPath, {
      [MARIA_PAYMENT_SHELL_HEADER]: "1",
    }));
    expect(unrelated.headers.get(forwarded)).toBeNull();

    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "false");
    const disabled = await proxy(hostRequest("makeupbymaria.se", validPath));
    expect(disabled.headers.get(forwarded)).toBeNull();
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

  it("keeps Maria's public host disabled until the Production site switch is enabled", async () => {
    for (const host of ["makeupbymaria.se", "www.makeupbymaria.se"]) {
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
      expect((await proxy(hostRequest(host, "/"))).status).toBe(404);

      vi.stubEnv("VERCEL_ENV", "production");
      vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "false");
      expect((await proxy(hostRequest(host, "/"))).status).toBe(404);

      vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
      const live = await proxy(hostRequest(host, "/"));
      if (host.startsWith("www.")) {
        expect(live.status).toBe(307);
        expect(live.headers.get("location")).toBe("https://makeupbymaria.se/");
        expect(live.headers.get("x-middleware-rewrite")).toBeNull();
      } else {
        expect(live.status).toBe(200);
        expect(live.headers.get("x-middleware-rewrite")).toBe(
          "https://" + host + "/demo/makeup-by-maria-v2.html",
        );
        expect(live.headers.get("x-robots-tag")).toBeNull();
      }
      for (const pathname of ["/dashboard", "/admin", "/boka/primeview", "/boka/other", "/tjanster", "/booking"]) {
        expect((await proxy(hostRequest(host, pathname))).status, pathname).toBe(404);
      }
      const verification = await proxy(hostRequest(host, "/boka/verifiera/00000000-0000-4000-8000-000000000010"));
      if (host.startsWith("www.")) {
        expect(verification.status).toBe(307);
        expect(verification.headers.get("location")).toBe(
          "https://makeupbymaria.se/boka/verifiera/00000000-0000-4000-8000-000000000010",
        );
      } else {
        expect(verification.status).toBe(200);
      }
    }
    expect(resolvePublicCustomDomainMock).not.toHaveBeenCalled();
  });

  it("redirects the dotted Maria apex to the canonical booking origin without exposing forbidden paths", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    for (const [path, destination] of [
      ["/?lang=en", "https://makeupbymaria.se/?lang=en"],
      ["/boka/makeup-by-maria", "https://makeupbymaria.se/boka/makeup-by-maria"],
    ]) {
      const response = await proxy(hostRequest("makeupbymaria.se.", path));
      expect(response.status, path).toBe(307);
      expect(response.headers.get("location"), path).toBe(destination);
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    }
    expect((await proxy(hostRequest("makeupbymaria.se.", "/dashboard"))).status).toBe(404);
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "false");
    expect((await proxy(hostRequest("makeupbymaria.se.", "/"))).status).toBe(404);
  });

  it("enforces Maria host restrictions for direct dotted demo HTML requests", async () => {
    const htmlPaths = ["/demo/makeup-by-maria.html", "/demo/makeup-by-maria-v2.html"];
    for (const path of htmlPaths) {
      // These exact paths would otherwise be excluded by the generic dotted-file matcher.
      expect(config.matcher).toContain(path);
      for (const host of ["makeupbymaria.se", "www.makeupbymaria.se"]) {
        for (const flag of ["false", "true"]) {
          vi.stubEnv("VERCEL_ENV", "production");
          vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", flag);
          const response = await proxy(hostRequest(host, path));
          expect(response.status, host + path).toBe(404);
        }
      }
      // Direct demo URLs remain accessible for testing but must not be indexed.
      const demoResponse = await proxy(hostRequest("www.proffera.se", path));
      expect(demoResponse.status).toBe(200);
      expect(demoResponse.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
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
