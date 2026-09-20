import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateDirectory: vi.fn(),
  invalidateMarketplace: vi.fn(),
}));

vi.mock("@/lib/company-directory-public-cache", () => ({
  invalidatePublicDirectoryPublicProjectionByProfileId: mocks.invalidateDirectory,
}));
vi.mock("@/lib/public-read-cache", () => ({
  invalidateMarketplaceHomeCompaniesCache: mocks.invalidateMarketplace,
}));

import { invalidateCompanyDirectoryAuthorityCachesBestEffort } from "@/lib/company-directory-authority-cache";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";

describe("Company Directory authority-writer cache invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates Directory and Marketplace independently after a committed authority change", async () => {
    mocks.invalidateDirectory.mockRejectedValueOnce(new Error("Directory cache unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(invalidateCompanyDirectoryAuthorityCachesBestEffort(
      PROFILE_ID,
      "committed SCB authority change",
    )).resolves.toBeUndefined();

    expect(mocks.invalidateDirectory).toHaveBeenCalledWith(PROFILE_ID);
    expect(mocks.invalidateMarketplace).toHaveBeenCalledTimes(1);
  });

  it("binds SCB replacements and Official Facts token replacements to the shared post-commit boundary", () => {
    const scb = readFileSync(resolve(process.cwd(), "src/lib/company-directory-scb-enrichment.ts"), "utf8");
    const facts = readFileSync(resolve(process.cwd(), "src/lib/company-directory-official-facts.ts"), "utf8");

    expect(scb).toContain("previous.source_payload_hash is distinct from upserted.source_payload_hash");
    expect(scb).toContain("previous.workplaces is distinct from upserted.workplaces");
    expect(scb).toContain("previous.conflicts is distinct from upserted.conflicts");
    expect(scb).toContain("committed SCB authority change");
    expect(facts).toContain("committed Official Facts authority change");
    expect(facts.indexOf("await invalidateCompanyDirectoryAuthorityCachesBestEffort")).toBeGreaterThan(
      facts.indexOf("on conflict (profile_id) do update set"),
    );
  });
});
