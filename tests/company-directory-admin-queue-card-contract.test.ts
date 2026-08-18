import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { getCompanyDirectoryPendingVerificationCount } from "@/lib/company-directory-admin-queue";

describe("company directory pending verification count", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
  });

  it("returns zero when the directory database is unavailable", async () => {
    mocks.getSql.mockReturnValue(null);

    await expect(getCompanyDirectoryPendingVerificationCount()).resolves.toBe(0);
  });

  it("returns the pending_verify queue count", async () => {
    const queries: string[] = [];
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.reduce(
        (result, part, index) => result + part + (index < values.length ? String(values[index]) : ""),
        "",
      );
      queries.push(query);
      return [{ count: 37 }];
    });
    mocks.getSql.mockReturnValue(sql);

    await expect(getCompanyDirectoryPendingVerificationCount()).resolves.toBe(37);
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("from company_directory_discovery_queue");
    expect(queries[0]).toContain("where state = 'pending_verify'");
  });

  it("returns zero when the discovery queue table is missing", async () => {
    const missingTable = Object.assign(new Error("missing relation"), { code: "42P01" });
    mocks.getSql.mockReturnValue(vi.fn(async () => {
      throw missingTable;
    }));

    await expect(getCompanyDirectoryPendingVerificationCount()).resolves.toBe(0);
  });

  it("propagates unrelated database errors instead of showing an empty queue", async () => {
    const permissionError = Object.assign(
      new Error("permission denied for table company_directory_discovery_queue"),
      { code: "42501" },
    );
    mocks.getSql.mockReturnValue(vi.fn(async () => {
      throw permissionError;
    }));

    await expect(getCompanyDirectoryPendingVerificationCount()).rejects.toBe(permissionError);
  });
});
