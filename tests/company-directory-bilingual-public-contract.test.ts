import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublicBusinessProfileViewForRequest: vi.fn(),
  getClaimedDirectoryWorkspaceSlug: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/business-profile-public", () => ({
  getPublicBusinessProfileViewForRequest: mocks.getPublicBusinessProfileViewForRequest,
}));
vi.mock("@/lib/company-directory-routing", () => ({
  getClaimedDirectoryWorkspaceSlug: mocks.getClaimedDirectoryWorkspaceSlug,
}));

import { PublicDirectoryProfile } from "../src/components/company-directory/public-directory-profile";
import { directoryProfileCopy } from "../src/components/company-directory/public-directory-profile-copy";

function source(path: string) { return readFileSync(resolve(process.cwd(), path), "utf8"); }

function walkReactTree(node: ReactNode, visit: (value: ReactNode) => void) {
  if (Array.isArray(node)) {
    for (const child of node) walkReactTree(child, visit);
    return;
  }
  if (!isValidElement(node)) {
    visit(node);
    return;
  }
  visit(node);
  walkReactTree((node.props as { children?: ReactNode }).children, visit);
}

function renderedText(node: ReactNode) {
  const parts: string[] = [];
  walkReactTree(node, (value) => {
    if (typeof value === "string" || typeof value === "number") parts.push(String(value));
  });
  return parts.join("");
}

const OFFICIAL_FACTS_CHECKED_AT = "2026-09-01T10:30:00.000Z";

function profileView() {
  return {
    business: {
      id: "11111111-1111-4111-8111-111111111111",
      slug: "freshness-company-ab",
      companyName: "Freshness Company AB",
      categorySlug: "stadning",
      primarySniCode: "81210",
      primarySniLabel: "Lokalvård",
      activityDescription: "",
      addressLine1: "",
      postalCode: "151 00",
      city: "Södertälje",
      municipality: "Södertälje",
      legalForm: "Aktiebolag",
      organizationStatus: "Registrerad",
      organizationNumber: "5560000000",
      lastCheckedAt: OFFICIAL_FACTS_CHECKED_AT,
      media: null,
      contact: {
        entitled: false,
        addressLine1: "",
        phone: "",
        email: "",
        website: "",
        available: {
          addressLine1: false,
          phone: false,
          email: false,
          website: false,
        },
      },
    },
    extras: {
      services: [],
      serviceAreas: [],
      reputation: null,
    },
    profile: {
      identity: {
        ownershipState: "unclaimed" as const,
        workspaceSlug: "",
      },
      capabilities: {
        richWebsite: false,
      },
    },
  };
}

describe("bilingual public directory contract", () => {
  const copy = source("src/components/company-directory/public-directory-copy.ts");
  const form = source("src/components/company-directory/public-directory-search-form.tsx");
  const shell = source("src/components/company-directory/public-directory-search-page.tsx");
  const header = source("src/components/layout/header.tsx");
  const localeRouting = source("src/lib/public-locale.ts");
  const results = source("src/components/company-directory/public-directory-results.tsx");
  const globals = source("src/app/globals.css");
  const swedishProfile = source("src/app/foretag/listad/[slug]/page.tsx");
  const englishSearch = source("src/app/en/companies/page.tsx");
  const englishProfile = source("src/app/en/companies/[slug]/page.tsx");
  const profile = source("src/components/company-directory/public-directory-profile.tsx");
  const search = source("src/lib/company-directory-public-search.ts");

  beforeEach(() => {
    mocks.getPublicBusinessProfileViewForRequest.mockReset();
    mocks.getClaimedDirectoryWorkspaceSlug.mockReset();
    mocks.getClaimedDirectoryWorkspaceSlug.mockResolvedValue(null);
  });

  it("keeps Swedish and English customer routes together", () => {
    expect(copy).toContain('search: "/foretag/listad"');
    expect(copy).toContain('search: "/en/companies"');
    expect(localeRouting).toContain('{ sv: "/foretag/listad", en: "/en/companies" }');
    expect(header).toContain("getAlternateLocalePath(pathname)");
    expect(englishSearch).toContain('locale="en"');
    expect(englishProfile).toContain('locale="en"');
    expect(swedishProfile).toContain("PublicDirectoryProfile");
    expect(swedishProfile).toContain('locale="sv"');
    expect(profile).toContain("alternateBase");
    expect(profile).toContain("t.language");
  });

  it("normalizes customer-facing English service terms on both client and server", () => {
    expect(copy).toContain('plumber: "vvs"');
    expect(copy).toContain('electrician: "elinstallation"');
    expect(copy).toContain('"window cleaning": "fonsterputsning"');
    expect(copy).toContain("normalizeDirectoryPublicServiceQuery");
    expect(form).toContain("normalizeDirectoryPublicServiceQuery");
    expect(shell).toContain("const searchService = normalizeDirectoryPublicServiceQuery(service, locale)");
    expect(shell).toContain("service: searchService");
  });

  it("localizes comparison-card labels while keeping official Swedish source text on profiles", () => {
    expect(results).toContain("directoryServiceLabel");
    expect(results).toContain("t.verifiedDetails");
    expect(results).not.toContain("result.activityDescription");
    expect(profile).toContain('lang="sv"');
  });

  it("shows authoritative Official Facts freshness instead of generic profile-sync freshness", async () => {
    const profileCopy = source("src/components/company-directory/public-directory-profile-copy.ts");
    const publicData = source("src/lib/company-directory-public-data.ts");

    expect(profileCopy).toContain('lastChecked: "Officiella fakta senast verifierade"');
    expect(profileCopy).toContain('lastChecked: "Official facts last verified"');
    expect(profileCopy).toContain("SCB-data kan ha en separat synktid");
    expect(profileCopy).toContain("SCB data can have a separate sync time");
    expect(publicData).toContain("company_directory_official_facts");
    expect(publicData).toContain("official_facts_last_synced_at");
    expect(publicData).toContain("lastCheckedAt: row.official_facts_last_synced_at");
    expect(publicData).not.toContain("lastCheckedAt: row.last_synced_at");

    mocks.getPublicBusinessProfileViewForRequest.mockResolvedValue(profileView());
    for (const locale of ["sv", "en"] as const) {
      const text = renderedText(await PublicDirectoryProfile({ slug: "freshness-company-ab", locale }));
      const formattedDate = new Intl.DateTimeFormat(locale === "en" ? "en-SE" : "sv-SE", {
        dateStyle: "medium",
        timeZone: "Europe/Stockholm",
      }).format(new Date(OFFICIAL_FACTS_CHECKED_AT));

      expect(text).toContain(directoryProfileCopy[locale].lastChecked);
      expect(text).toContain(formattedDate);
      expect(text).toContain(`${directoryProfileCopy[locale].lastChecked}: ${formattedDate}.`);
    }
  });

  it("scopes the contrast override to result CTAs so locale links remain readable", () => {
    expect(results).toContain("directory-profile-result-cta");
    expect(globals).toContain(".directory-profile-result-cta");
    expect(globals).not.toContain('a[href^="/en/companies/"]');
    expect(globals).not.toContain('a[href^="/foretag/listad/"]');
  });

  it("publishes reciprocal language metadata for Swedish company profiles", () => {
    expect(swedishProfile).toContain('"sv-SE": swedishPath');
    expect(swedishProfile).toContain("en: englishPath");
  });

  it("does not weaken the public publication boundary", () => {
    expect(search).toContain("profile.publication_status = 'published'");
    expect(search).not.toContain("profile.publication_status in ('ready', 'published')");
    expect(search).toContain("location.is_public = true");
  });

  it("does not expose the Swedish-only claim action on the English profile", () => {
    expect(profile).toContain('locale === "sv"');
    expect(profile).toContain("/foretag/claim/");
  });
});