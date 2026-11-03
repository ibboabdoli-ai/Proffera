import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { searchPublishedCompanyDirectory } from "@/lib/company-directory-public-search";

describe("public Directory location query alias", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
  });

  it.each([
    ["Sodertalje", "södertälje"],
    ["SODERTALJE", "södertälje"],
    ["Södertälje", "södertälje"],
    ["Stockholm", "stockholm"],
    ["Habo", "habo"],
    ["Håbo", "håbo"],
  ])("binds location %s as %s without broadening Swedish place names", async (input, expected) => {
    const sql = vi.fn().mockResolvedValue([{ total_count: 0 }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await searchPublishedCompanyDirectory({
      service: "elektriker",
      location: input,
    });

    expect(result.locationQuery).toBe(input);
    expect(result.totalCount).toBe(0);
    expect(sql).toHaveBeenCalledTimes(1);
    expect(sql.mock.calls[0]?.slice(1)).toContain(expected);
  });
});
