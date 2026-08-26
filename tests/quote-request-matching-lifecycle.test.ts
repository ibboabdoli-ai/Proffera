import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { getLeadMatches } from "@/features/matching/list";
import {
  isQuoteRequestOpenForMatchingOrDelivery,
  QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES,
} from "@/lib/quote-request-lifecycle";

describe("Quote Request matching and delivery lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSql.mockReset();
  });

  it("keeps one canonical set of statuses open for new matching and delivery", () => {
    expect(QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES).toEqual([
      "submitted",
      "pending_review",
      "approved",
      "matched",
      "answered",
    ]);

    for (const status of QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES) {
      expect(isQuoteRequestOpenForMatchingOrDelivery(status)).toBe(true);
    }
  });

  it.each(["draft", "booked", "completed", "cancelled", "rejected", "selected", "expired", ""])(
    "fails closed for a status that cannot receive new matching or delivery: %s",
    (status) => {
      expect(isQuoteRequestOpenForMatchingOrDelivery(status)).toBe(false);
    },
  );

  it("filters legacy matching to the canonical open statuses before the result limit", async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({
        text: strings.join(" ? ").replace(/\s+/g, " ").trim(),
        values,
      });
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const result = await getLeadMatches();

    expect(result).toEqual({ ok: true, matches: [] });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.values).toEqual([...QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES]);
    expect(calls[0]?.text).toContain("from quote_requests where status in (");
    expect(calls[0]?.text.indexOf("where status in (")).toBeLessThan(
      calls[0]?.text.indexOf("order by created_at desc") ?? -1,
    );
    expect(calls[0]?.text.indexOf("order by created_at desc")).toBeLessThan(
      calls[0]?.text.indexOf("limit 50") ?? -1,
    );
  });
});
