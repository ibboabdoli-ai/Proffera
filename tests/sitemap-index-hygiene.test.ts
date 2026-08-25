import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  host: "www.proffera.se",
  sqlRows: [] as Array<Record<string, unknown>>,
  sqlQuery: "",
  directoryLandings: [] as Array<Record<string, unknown>>,
  directoryEntries: [] as Array<Record<string, unknown>>,
  customTarget: null as null | { workspaceSlug: string; publicHomeMode: string },
  hub: null as null | {
    workspace: { status: string; companyName: string; slug: string };
    services: Array<{ publicSlug: string }>;
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (name: string) => name.toLowerCase() === "host" ? mocks.host : null })),
}));
vi.mock("@/lib/db/server", () => ({
  getSql: vi.fn(() => async (strings: TemplateStringsArray) => {
    mocks.sqlQuery = strings.join("?");
    return mocks.sqlRows;
  }),
}));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  hasWorkspaceFeatureAccessForWorkspace: vi.fn(async () => true),
}));
vi.mock("@/lib/company-directory-landing-seo", () => ({
  listDirectorySeoLandings: vi.fn(async () => mocks.directoryLandings),
}));
vi.mock("@/lib/company-directory-seo", () => ({
  listPublishedDirectorySitemapEntries: vi.fn(async () => mocks.directoryEntries),
}));
vi.mock("@/lib/public-site-domain-routing", () => ({
  resolvePublicCustomDomain: vi.fn(async () => mocks.customTarget),
}));
vi.mock("@/lib/public-business-hub", () => ({
  getPublicBusinessHub: vi.fn(async () => mocks.hub),
}));

import registrationLayout, { metadata as registrationMetadata } from "../src/app/anslut-foretag/registrera/layout";
import thankYouLayout, { metadata as thankYouMetadata } from "../src/app/anslut-foretag/tack/layout";
import englishRegistrationLayout, { metadata as englishRegistrationMetadata } from "../src/app/en/join-business/register/layout";
import englishThankYouLayout, { metadata as englishThankYouMetadata } from "../src/app/en/join-business/thank-you/layout";
import sitemap from "../src/app/sitemap";
import { listPublicBusinessSitemapEntries } from "@/lib/public-business-seo";

const ACTIVE_WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const RENAMED_WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const TRIAL_WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const TEST_WORKSPACE_ID = "44444444-4444-4444-8444-444444444444";

describe("sitemap index hygiene", () => {
  beforeEach(() => {
    mocks.host = "www.proffera.se";
    mocks.sqlRows = [];
    mocks.sqlQuery = "";
    mocks.directoryLandings = [];
    mocks.directoryEntries = [];
    mocks.customTarget = null;
    mocks.hub = null;
  });

  it("emits noindex/follow metadata from registration and confirmation layouts", () => {
    for (const metadata of [
      registrationMetadata,
      thankYouMetadata,
      englishRegistrationMetadata,
      englishThankYouMetadata,
    ]) {
      expect(metadata.robots).toEqual({ index: false, follow: true });
    }

    expect(registrationLayout({ children: "sv-register" })).toBe("sv-register");
    expect(thankYouLayout({ children: "sv-thanks" })).toBe("sv-thanks");
    expect(englishRegistrationLayout({ children: "en-register" })).toBe("en-register");
    expect(englishThankYouLayout({ children: "en-thanks" })).toBe("en-thanks");
  });

  it("filters platform business sitemap entries with the trimmed effective company name and active status", async () => {
    mocks.sqlRows = [
      {
        workspace_id: ACTIVE_WORKSPACE_ID,
        workspace_slug: "real-company",
        status: "active",
        company_name: "Real Company AB",
        service_slug: "maleri",
      },
      {
        workspace_id: RENAMED_WORKSPACE_ID,
        workspace_slug: "renamed-company",
        status: "active",
        company_name: "Owner Renamed AB",
        service_slug: null,
      },
      {
        workspace_id: TRIAL_WORKSPACE_ID,
        workspace_slug: "trial-company",
        status: "trial",
        company_name: "Trial Company AB",
        service_slug: null,
      },
      {
        workspace_id: TEST_WORKSPACE_ID,
        workspace_slug: "test-company",
        status: "active",
        company_name: "Proffera Test Workspace",
        service_slug: null,
      },
    ];

    await expect(listPublicBusinessSitemapEntries()).resolves.toEqual([
      {
        workspaceId: ACTIVE_WORKSPACE_ID,
        workspaceSlug: "real-company",
        serviceSlug: "maleri",
      },
      {
        workspaceId: RENAMED_WORKSPACE_ID,
        workspaceSlug: "renamed-company",
        serviceSlug: null,
      },
    ]);

    expect(mocks.sqlQuery).toContain("left join workspace_settings settings");
    expect(mocks.sqlQuery).toContain("nullif(btrim(settings.company_name), '')");
    expect(mocks.sqlQuery).toContain("nullif(btrim(workspace.company_name), '')");
    expect(mocks.sqlQuery).toContain("nullif(btrim(workspace.name), '')");
  });

  it("adds only quality-gated Directory landing URLs to the platform sitemap", async () => {
    mocks.directoryLandings = [{
      serviceSlug: "maleri",
      serviceLabel: "Måleri",
      location: "Södertälje",
      locationSlug: "sodertalje",
      businessCount: 3,
    }];

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toContain("https://www.proffera.se/hitta/maleri/sodertalje");
    expect(urls).not.toContain("https://www.proffera.se/foretag/listad");
    expect(urls).not.toContain("https://www.proffera.se/anslut-foretag/registrera");
    expect(urls).not.toContain("https://www.proffera.se/anslut-foretag/tack");
    expect(urls).not.toContain("https://www.proffera.se/en/join-business/register");
    expect(urls).not.toContain("https://www.proffera.se/en/join-business/thank-you");
  });

  it("uses the same active/non-test policy for custom-domain sitemaps", async () => {
    mocks.host = "example.se";
    mocks.customTarget = { workspaceSlug: "custom-company", publicHomeMode: "website" };
    mocks.hub = {
      workspace: { status: "active", companyName: "Custom Company AB", slug: "custom-company" },
      services: [{ publicSlug: "maleri" }],
    };

    await expect(sitemap()).resolves.toEqual([
      { url: "https://example.se/", changeFrequency: "weekly", priority: 1 },
      { url: "https://example.se/tjanster/maleri", changeFrequency: "monthly", priority: 0.9 },
    ]);

    mocks.hub = {
      workspace: { status: "trial", companyName: "Trial Company AB", slug: "custom-company" },
      services: [],
    };
    await expect(sitemap()).resolves.toEqual([]);

    mocks.hub = {
      workspace: { status: "active", companyName: "Proffera Test Custom", slug: "custom-company" },
      services: [],
    };
    await expect(sitemap()).resolves.toEqual([]);
  });
});
