import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getMarketplaceClaimPaidCtaCopy, normalizeMarketplaceClaimPaidCtaLocale } from "../src/lib/marketplace-claim-paid-cta";

describe("Marketplace Claim to Paid CTA", () => {
  it("keeps Swedish as the default and routes to the existing Starter billing surface", () => {
    expect(normalizeMarketplaceClaimPaidCtaLocale(undefined)).toBe("sv");
    expect(normalizeMarketplaceClaimPaidCtaLocale("sv")).toBe("sv");

    const copy = getMarketplaceClaimPaidCtaCopy("sv");
    expect(copy.href).toBe("/dashboard/installningar?lang=sv&plan=starter");
    expect(copy.action).toBe("Öppna planer");
  });

  it("preserves English when routing to the existing billing surface", () => {
    expect(normalizeMarketplaceClaimPaidCtaLocale("en")).toBe("en");

    const copy = getMarketplaceClaimPaidCtaCopy("en");
    expect(copy.href).toBe("/dashboard/installningar?lang=en&plan=starter");
    expect(copy.action).toBe("Open plans");
  });

  it("gates the CTA on both the linked Directory profile and subscription-management permission", () => {
    const layoutSource = readFileSync(join(process.cwd(), "src/app/dashboard/marknadsplats/layout.tsx"), "utf8");

    expect(layoutSource).toContain("providerState?.linkedDirectoryProfileId");
    expect(layoutSource).toContain("canManageWorkspaceMembers(access)");
    expect(layoutSource).toContain("hasLinkedClaimedProfile && canManageSubscription");
    expect(layoutSource).toContain("<MarketplaceClaimPaidCta />");
    expect(layoutSource).not.toMatch(/\/api\/stripe|checkout|create.*subscription|update.*subscription/i);
  });
});
