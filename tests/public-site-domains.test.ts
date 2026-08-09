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

  it("rejects unsafe or reserved custom-domain inputs", () => {
    expect(normalizeCustomDomainInput("https://example.com/path")).toBe("");
    expect(normalizeCustomDomainInput("https://example.com?x=1")).toBe("");
    expect(normalizeCustomDomainInput("https://example.com:8443")).toBe("");
    expect(normalizeCustomDomainInput("localhost")).toBe("");
    expect(normalizeCustomDomainInput("proffera.se")).toBe("");
    expect(normalizeCustomDomainInput("www.proffera.se")).toBe("");
    expect(normalizeCustomDomainInput("*.example.com")).toBe("");
  });

  it("keeps platform and bespoke PrimeView hosts distinguishable", () => {
    expect(isPlatformHost("proffera.se")).toBe(true);
    expect(isPlatformHost("proffera-jhap.vercel.app")).toBe(true);
    expect(isPlatformHost("customer.example.com")).toBe(false);
    expect(isPrimeViewHost("www.primeviewwindowcare.co.uk")).toBe(true);
    expect(normalizeCustomDomainInput("https://www.primeviewwindowcare.co.uk/")).toBe("www.primeviewwindowcare.co.uk");
  });

  it("routes generic customer domains through canonical workspace entitlements", () => {
    const proxy = source("src/proxy.ts");
    const routing = source("src/lib/public-site-domain-routing.ts");

    expect(proxy).toContain("export async function proxy");
    expect(proxy).toContain("resolvePublicCustomDomain(host)");
    expect(proxy).toContain("if (!target) return notFound()");
    expect(proxy).toContain('new URL("/demo/primeview", request.url)');
    expect(proxy).toContain('target.publicHomeMode === "website"');
    expect(proxy).toContain("/foretag/${encodeURIComponent(target.workspaceSlug)}");
    expect(proxy).toContain("/boka/${encodeURIComponent(target.bookingSlug)}");

    expect(routing).toContain('hasWorkspaceFeatureAccessForWorkspace(workspaceId, "custom_domain")');
    expect(routing).toContain('publicHomeMode === "website" ? "website_builder" : "online_booking"');
    expect(routing).toContain("coalesce(experience.public_home_mode, 'booking')");
    expect(routing).toContain("custom_domain_status = 'connected'");
    expect(routing).toContain("limit 2");
  });

  it("hardens self-service domain settings and resets connection state on change", () => {
    const experience = source("src/lib/workspace-experience.ts");
    const settingsPage = source("src/app/dashboard/installningar/utseende/page.tsx");
    const builder = source("src/app/dashboard/installningar/utseende/booking-page-builder.tsx");

    expect(experience).toContain("normalizeCustomDomainInput(rawCustomDomain)");
    expect(experience).toContain('throw new Error("INVALID_CUSTOM_DOMAIN")');
    expect(experience).toContain('throw new Error("CUSTOM_DOMAIN_TAKEN")');
    expect(experience).toContain("workspace_id <> ${access.workspaceId}::uuid");
    expect(experience).toContain("workspace_experience_settings.custom_domain is distinct from excluded.custom_domain");
    expect(experience).toContain("then 'disconnected'");

    expect(settingsPage).toContain('hasWorkspaceFeature("custom_domain")');
    expect(settingsPage).toContain('error: "domain_taken"');
    expect(settingsPage).toContain('error: "domain"');
    expect(settingsPage).toContain("ensureVercelCustomDomain");
    expect(settingsPage).toContain("removeVercelCustomDomain");
    expect(builder).toContain("disabled={!customDomainEnabled}");
    expect(builder).toContain("Egen domän väntar på anslutning");
  });
});