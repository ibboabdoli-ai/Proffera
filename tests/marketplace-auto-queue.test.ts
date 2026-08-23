import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSql: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import {
  getMarketplaceAutoQueuePage,
  MARKETPLACE_AUTO_QUEUE_PAGE_SIZE,
} from "@/features/matching/marketplace-auto-queue";

const originalEnv = { ...process.env };

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
}

describe("Marketplace Auto Worker queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MARKETPLACE_AUTO_WORKER_NOT_BEFORE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reads open requests oldest-first with offer counts and a bounded page", async () => {
    const sql = vi.fn(async () => [{
      quote_request_id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-08-20T08:00:00.000Z",
      submitted_offer_count: 1,
      priority_rank: 1,
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getMarketplaceAutoQueuePage({ limit: 999 });

    expect(result).toEqual({ ok: true, rows: [{
      quoteRequestId: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-08-20T08:00:00.000Z",
      submittedOfferCount: 1,
      priorityRank: 1,
    }] });
    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("request.status in ('submitted', 'pending_review', 'approved', 'matched', 'answered')");
    expect(query).toContain("offer.status in ('submitted', 'selected')");
    expect(query).toContain("order by priority_rank asc, created_at_sort asc, quote_request_id asc");
    expect(query).toContain("limit ?");
    expect(sql.mock.calls[0]).toContain(MARKETPLACE_AUTO_QUEUE_PAGE_SIZE);
  });

  it("filters out requests created before the configured rollout cutoff", async () => {
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);
    process.env.MARKETPLACE_AUTO_WORKER_NOT_BEFORE = "2026-08-23T09:24:45Z";

    await getMarketplaceAutoQueuePage();

    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("request.created_at >= nullif( ? , '')::timestamptz");
    expect(sql.mock.calls[0]).toContain("2026-08-23T09:24:45.000Z");
  });

  it("does not turn a malformed optional cutoff into a partial timestamp filter", async () => {
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);
    process.env.MARKETPLACE_AUTO_WORKER_NOT_BEFORE = "not-a-date";

    await getMarketplaceAutoQueuePage();

    expect(sql.mock.calls[0]).toContain("");
    expect(sql.mock.calls[0]).not.toContain("not-a-date");
  });

  it("prioritizes leased rematches and uses a full composite cursor for later pages", async () => {
    const sql = vi.fn(async () => []);
    mocks.getSql.mockReturnValue(sql);
    const priorityId = "11111111-1111-4111-8111-111111111111";

    await getMarketplaceAutoQueuePage({
      priorityQuoteRequestIds: [priorityId],
      afterPriorityRank: 0,
      afterCreatedAt: "2026-08-20T08:00:00.000Z",
      afterId: "22222222-2222-4222-8222-222222222222",
    });

    const query = queryText(sql.mock.calls[0]);
    expect(query).toContain("when request.id = any(string_to_array(nullif( ? , ''), ',')::uuid[]) then 0");
    expect(query).toContain("priority_rank > ? ::int");
    expect(query).toContain("created_at_sort > nullif( ? , '')::timestamptz");
    expect(query).toContain("quote_request_id > ?");
    expect(sql.mock.calls[0]).toContain(priorityId);
  });

  it("fails closed when the database is unavailable", async () => {
    mocks.getSql.mockReturnValue(null);

    await expect(getMarketplaceAutoQueuePage()).resolves.toEqual({
      ok: false,
      message: "Databasen är inte konfigurerad.",
      rows: [],
    });
  });

  it("fails closed when the queue query throws", async () => {
    mocks.getSql.mockReturnValue(vi.fn().mockRejectedValue(new Error("database unavailable")));

    await expect(getMarketplaceAutoQueuePage()).resolves.toEqual({
      ok: false,
      message: "Kunde inte läsa Marketplace-kön.",
      rows: [],
    });
  });
});
