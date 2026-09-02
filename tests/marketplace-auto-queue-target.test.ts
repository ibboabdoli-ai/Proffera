import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSql: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { getMarketplaceAutoQueuePage } from "@/features/matching/marketplace-auto-queue";

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

describe("Marketplace targeted queue reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MARKETPLACE_AUTO_WORKER_NOT_BEFORE;
  });

  it("constrains an event read to the requested public reference", async () => {
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);

    await getMarketplaceAutoQueuePage({
      onlyReferenceIds: ["PRO-ABC123-XYZ99"],
    });

    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("request.reference_id = any(string_to_array(nullif( ? , ''), ','))");
    expect(sql.mock.calls[0]).toContain("PRO-ABC123-XYZ99");
  });

  it("does not fall back to the full queue when every requested reference is invalid", async () => {
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);

    await expect(getMarketplaceAutoQueuePage({
      onlyReferenceIds: ["not-a-reference"],
    })).resolves.toEqual({ ok: true, rows: [] });

    expect(sql).not.toHaveBeenCalled();
  });
});
