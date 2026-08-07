import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createUnconfiguredVercelCustomDomainStatus,
  deriveVercelCustomDomainState,
  extractVercelRecommendedValues,
  extractVercelVerificationRecords,
} from "../src/lib/vercel-custom-domain-policy";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("automatic Vercel custom-domain provisioning", () => {
  it("derives connection state without treating unknown DNS state as connected", () => {
    expect(deriveVercelCustomDomainState({ projectAttached: false, verified: false, misconfigured: null })).toBe("missing");
    expect(deriveVercelCustomDomainState({ projectAttached: true, verified: false, misconfigured: true })).toBe("verification");
    expect(deriveVercelCustomDomainState({ projectAttached: true, verified: true, misconfigured: true })).toBe("dns");
    expect(deriveVercelCustomDomainState({ projectAttached: true, verified: true, misconfigured: null })).toBe("dns");
    expect(deriveVercelCustomDomainState({ projectAttached: true, verified: true, misconfigured: false })).toBe("connected");
  });

  it("sanitizes DNS and verification values returned by Vercel", () => {
    expect(extractVercelRecommendedValues(["cname.vercel-dns.com", { value: "76.76.21.21" }, null])).toEqual([
      "cname.vercel-dns.com",
      "76.76.21.21",
    ]);
    expect(extractVercelVerificationRecords([
      { type: "TXT", domain: "_vercel.example.com", value: "verify-me" },
      { type: "TXT", value: "" },
    ])).toEqual([{ type: "TXT", domain: "_vercel.example.com", value: "verify-me" }]);
  });

  it("fails closed when automation is not configured", () => {
    expect(createUnconfiguredVercelCustomDomainStatus()).toMatchObject({
      state: "unconfigured",
      automationConfigured: false,
      projectAttached: false,
      verified: false,
    });
  });

  it("keeps Vercel mutations server-only, production-only and scoped to the saved domain", () => {
    const client = source("src/lib/vercel-custom-domains.ts");
    const settings = source("src/app/dashboard/installningar/utseende/page.tsx");
    const experience = source("src/lib/workspace-experience.ts");

    expect(client).toContain('import "server-only"');
    expect(client).toContain('env.VERCEL_ENV !== "production"');
    expect(client).toContain("PROFFERA_VERCEL_API_TOKEN");
    expect(client).toContain('headers.set("Authorization", `Bearer ${config.token}`)');
    expect(client).toContain("/v10/projects/${encodeURIComponent(config.projectId)}/domains");
    expect(client).toContain("/verify");
    expect(client).toContain("/v6/domains/${encodeURIComponent(domain)}/config");
    expect(client).toContain('if (isPrimeViewHost(domain)) return { ok: false, state: "protected" }');
    expect(client).toContain('{ method: "DELETE" }');
    expect(client).not.toContain('method: "PATCH"');
    expect(client).not.toContain("force");

    expect(settings).toContain("ensureVercelCustomDomain(customDomain)");
    expect(settings).toContain("syncSavedCustomDomain");
    expect(settings).toContain("disconnectSavedCustomDomain");
    expect(settings).toContain("removeVercelCustomDomain(settings.customDomain)");
    expect(settings).toContain("removeVercelCustomDomain(current.customDomain)");
    expect(settings).toContain("Koppla från domän");
    expect(settings).toContain("domain_protected");
    expect(settings).toContain("domain_cleanup");
    expect(experience).toContain("setWorkspaceCustomDomainConnectionStatus");
  });
});
