import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getPublicDirectoryBusiness: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: (...args: unknown[]) => unknown) => fn }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/company-directory-engine", () => ({
  getPublicDirectoryBusiness: mocks.getPublicDirectoryBusiness,
}));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  hasWorkspacePlanAccessForWorkspace: vi.fn().mockResolvedValue(false),
}));

import { getPublicDirectoryBusinessForRequest } from "@/lib/company-directory-public-data";

describe("public directory contact Preview compatibility", () => {
  it("keeps the public profile available when the Preview DB has no SCB enrichment table", async () => {
    mocks.getPublicDirectoryBusiness.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      slug: "preview-company",
      companyName: "Preview Company AB",
      legalForm: "Aktiebolag",
      organizationStatus: "Aktiv",
      categorySlug: "elektriker",
      primarySniLabel: "Elinstallationer",
      activityDescription: "Elinstallationer.",
      addressLine1: "Profilegatan 1",
      postalCode: "111 11",
      city: "Stockholm",
      municipality: "Stockholm",
      region: "Stockholm",
      qualityScore: 100,
      officialSource: "bolagsverket",
      sourceUpdatedAt: "",
      lastCheckedAt: "",
      media: null,
    });

    const missingTable = Object.assign(
      new Error('relation "company_directory_scb_enrichment" does not exist'),
      { code: "42P01" },
    );
    const sql = vi.fn()
      .mockResolvedValueOnce([{
        organization_number: "5561234567",
        primary_sni_code: "43.210",
        website_url: "",
        address_line1: "Profilegatan 1",
      }])
      .mockRejectedValueOnce(missingTable);
    mocks.getSql.mockReturnValue(sql);

    const result = await getPublicDirectoryBusinessForRequest("preview-company");

    expect(result?.publicationStatus).toBe("published");
    expect(result?.organizationNumber).toBe("5561234567");
    expect(result?.primarySniCode).toBe("43.210");
    expect(result?.contact).toEqual({
      addressLine1: "",
      phone: "",
      email: "",
      website: "",
      entitled: false,
      available: {
        addressLine1: true,
        phone: false,
        email: false,
        website: false,
      },
    });
  });
});
