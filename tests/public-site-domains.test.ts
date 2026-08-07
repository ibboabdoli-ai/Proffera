import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  hostnameFromHostHeader,
  isPlatformHost,
  isPrimeViewHost,
  normalizeCustomDomainInput,
} from "../src/lib/public-site-domains";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public custom-domain routing", () => {
  it("normalizes safe customer hostnames", () => {
    expect(normalizeCustomDomainInput("https://WWW.Example.com/")).toBe("www.example.com");
    expect(normalizeCustomDomainInput("booking.example.se")).toBe("booking.example.se");
    expect(hostnameFromHostHeader("Booking.Example.se:443")).toBe("booking.example.se");
  });

  it("rejects URL shapes that are not host-only custom domains", () => {
    expect(normalizeCustomDomainInput("https://example.com/path")).toBe("");
    expect(normalizeCustomDomainInput("https://example.com?x=1")).toBe("");
    expect(normalizeCustomDomainInput("https://example.com:8443")).toBe("");
    expect(normalizeCustomDomainInput("localhost")).toBe("");
  });

  it("keeps platform and bespoke PrimeView hosts distinguishable", () => {
    expect(isPlatformHost("proffera.se")).toBe(true);
    expect(isPlatformHost("proffera-jhap.vercel.app")).toBe(true);
    expect(isPlatformHost("customer.example.com")).toBe(false);
    expect(isPrimeViewHost("www.primeviewwindowcare.co.uk")).toBe(true);
  });

  it("lazy-loads server-only tenant routing only for custom-domain roots", () => {
    const proxy = source("src/proxy.ts");
    const routing = source("src/lib/public-site-domain-routing.ts");

    expect(proxy).toContain("export async function proxy");
    expect(proxy).toContain('await import("./lib/public-site-domain-routing")');
    expect(proxy).not.toContain('import { resolvePublicCustomDomain } from "./lib/public-site-domain-routing"');
    expect(proxy).toContain('pathname === "/" && !isPlatformHost(host)');
    expect(proxy).toContain("resolvePublicCustomDomain(host)");
    expect(proxy).toContain("if (!target) return notFound()");
    expect(proxy).toContain('new URL("/demo/primeview", request.url)');
    expect(routing).toContain('import "server-only"');
    expect(routing).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "custom_domain")');
    expect(routing).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "online_booking")');
    expect(routing).toContain("custom_domain_status = 'connected'");
    expect(routing).toContain("limit 2");
  });
});
