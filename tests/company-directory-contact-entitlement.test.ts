import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { gateDirectoryDirectContact } from "../src/lib/company-directory-contact-entitlement";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("company directory direct-contact entitlement", () => {
  it("fails closed for every direct contact field without plan entitlement", () => {
    expect(gateDirectoryDirectContact({
      addressLine1: "Examplegatan 1",
      phone: "+46 8 123 45 67",
      email: "kontakt@example.se",
      website: "https://example.se",
    }, false)).toEqual({
      addressLine1: "",
      phone: "",
      email: "",
      website: "",
    });
  });

  it("preserves normalized direct contact fields when plan entitlement exists", () => {
    expect(gateDirectoryDirectContact({
      addressLine1: "  Examplegatan 1  ",
      phone: "  +46 8 123 45 67  ",
      email: "  kontakt@example.se  ",
      website: "  https://example.se  ",
    }, true)).toEqual({
      addressLine1: "Examplegatan 1",
      phone: "+46 8 123 45 67",
      email: "kontakt@example.se",
      website: "https://example.se",
    });
  });

  it("routes public Directory profile and search address data through server-side plan gating", () => {
    const publicData = source("src/lib/company-directory-public-data.ts");
    const publicSearch = source("src/lib/company-directory-public-search.ts");
    const entitlement = source("src/lib/workspace-feature-entitlement-db.ts");

    expect(publicData).toContain("gateDirectoryDirectContact");
    expect(publicData).toContain("hasWorkspacePlanAccessForWorkspace");
    expect(publicData).toContain("{ addressLine1: published.addressLine1 }, false");
    expect(publicSearch).toContain("gateDirectoryDirectContact");
    expect(publicSearch).toContain("hasWorkspacePlanAccessForWorkspace");
    expect(publicSearch).toContain("Boolean(isClaimed && access?.planAccess)");
    expect(entitlement).toContain("minimumPlan: WorkspacePlanKey = \"starter\"");
    expect(entitlement).toContain("isWorkspacePlanFeatureIncluded");
  });
});
