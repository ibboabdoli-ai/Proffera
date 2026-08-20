import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  getWorkspaceDirectoryPublicAccessForWorkspaces: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  getWorkspaceDirectoryPublicAccessForWorkspaces: mocks.getWorkspaceDirectoryPublicAccessForWorkspaces,
}));

import { searchPublishedCompanyDirectory } from "@/lib/company-directory-public-search";

describe("company directory large-page pagination", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
    mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockReset();
    mocks.getWorkspaceDirectoryPublicAccessForWorkspaces.mockResolvedValue(new Map());
  });

  it("keeps page 10001 reachable when the real total has 10001 pages", async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce([{ total_count: 300_030 }])
      .mockResolvedValueOnce([{
        id: "large-page-company",
        public_slug: "large-page-company",
        display_name: "Large Page AB",
        category_slug: "vvs",
        publication_status: "published",
        service_slug: "vvs",
        service_label: "VVS / Rörmokare",
        activity_description: "",
        address_line1: "Testgatan 1",
        postal_code: "111 11",
        city: "Stockholm",
        municipality: "Stockholm",
        quality_score: 95,
        latitude: null,
        longitude: null,
        service_area_radius_km: null,
        claimed_workspace_id: null,
        claimed_workspace_slug: null,
        claimed_booking_slug: null,
        claimed_service_id: null,
        claimed_service_slug: null,
        claimed_service_conversion_mode: null,
        distance_km: null,
      }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await searchPublishedCompanyDirectory({ limit: 30, page: 10_001 });

    expect(sql).toHaveBeenCalledTimes(2);
    const resultQueryCall = sql.mock.calls[1] ?? [];
    expect(resultQueryCall.at(-2)).toBe(30);
    expect(resultQueryCall.at(-1)).toBe(300_000);
    expect(result.page).toBe(10_001);
    expect(result.totalCount).toBe(300_030);
    expect(result.totalPages).toBe(10_001);
    expect(result.results.map((company) => company.slug)).toContain("large-page-company");
  });
});
