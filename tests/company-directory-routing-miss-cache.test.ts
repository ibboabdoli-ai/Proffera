import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  hasWorkspaceFeatureAccessForWorkspace: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({
  hasWorkspaceFeatureAccessForWorkspace: mocks.hasWorkspaceFeatureAccessForWorkspace,
}));

import {
  invalidatePublicDirectoryProfileCache,
  setPublicDirectoryCacheAdapterForTests,
  type PublicDirectoryCacheAdapter,
  type PublicDirectoryCacheReadInput,
} from "@/lib/company-directory-public-cache";
import { getClaimedDirectoryWorkspaceSlug } from "@/lib/company-directory-routing";

type MemoryEntry = { value: unknown; tags: string[] };
const memoryEntries = new Map<string, MemoryEntry>();

const memoryCacheAdapter: PublicDirectoryCacheAdapter = {
  async read<T>(input: PublicDirectoryCacheReadInput<T>): Promise<T> {
    const key = JSON.stringify(input.keyParts);
    const existing = memoryEntries.get(key);
    if (existing) return existing.value as T;

    const decision = await input.loader();
    if (decision.cache) {
      memoryEntries.set(key, { value: decision.value, tags: [...input.tags] });
    }
    return decision.value;
  },
  invalidate(tag: string) {
    for (const [key, entry] of memoryEntries) {
      if (entry.tags.includes(tag)) memoryEntries.delete(key);
    }
  },
};

beforeEach(() => {
  memoryEntries.clear();
  setPublicDirectoryCacheAdapterForTests(memoryCacheAdapter);
  mocks.getSql.mockReset();
  mocks.hasWorkspaceFeatureAccessForWorkspace.mockReset();
});

afterEach(() => {
  setPublicDirectoryCacheAdapterForTests(null);
});

describe("Company Directory redirect miss cache", () => {
  it("turns repeated unknown redirect slugs into one database lookup", async () => {
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);

    for (let index = 0; index < 50; index += 1) {
      await expect(getClaimedDirectoryWorkspaceSlug("crawler-invented-company")).resolves.toBeNull();
    }

    expect(sql).toHaveBeenCalledTimes(1);
    expect(mocks.hasWorkspaceFeatureAccessForWorkspace).not.toHaveBeenCalled();
  });

  it("does not cache a real claimed workspace or its entitlement decision", async () => {
    const sql = vi.fn(async () => [{
      workspace_id: "22222222-2222-4222-8222-222222222222",
      slug: "claimed-workspace",
    }]);
    mocks.getSql.mockReturnValue(sql);
    mocks.hasWorkspaceFeatureAccessForWorkspace
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(getClaimedDirectoryWorkspaceSlug("claimed-company")).resolves.toBeNull();
    await expect(getClaimedDirectoryWorkspaceSlug("claimed-company")).resolves.toBe("claimed-workspace");

    expect(sql).toHaveBeenCalledTimes(2);
    expect(mocks.hasWorkspaceFeatureAccessForWorkspace).toHaveBeenCalledTimes(2);
  });

  it("profile invalidation clears a cached redirect miss", async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        workspace_id: "22222222-2222-4222-8222-222222222222",
        slug: "new-workspace",
      }]);
    mocks.getSql.mockReturnValue(sql);
    mocks.hasWorkspaceFeatureAccessForWorkspace.mockResolvedValue(true);

    await expect(getClaimedDirectoryWorkspaceSlug("new-claimed-company")).resolves.toBeNull();
    await expect(getClaimedDirectoryWorkspaceSlug("new-claimed-company")).resolves.toBeNull();
    expect(sql).toHaveBeenCalledTimes(1);

    invalidatePublicDirectoryProfileCache("new-claimed-company");
    await expect(getClaimedDirectoryWorkspaceSlug("new-claimed-company")).resolves.toBe("new-workspace");

    expect(sql).toHaveBeenCalledTimes(2);
  });
});
