import { describe, expect, it, vi } from "vitest";

import {
  isQuoteRequestStatus,
  persistQuoteRequestStatusChange,
  QUOTE_REQUEST_STATUSES,
  type QuoteRequestStatusSql,
} from "../src/features/admin/quote-request-status";

describe("quote-request status audit mutation", () => {
  it("accepts only the supported workflow statuses", () => {
    for (const status of QUOTE_REQUEST_STATUSES) {
      expect(isQuoteRequestStatus(status)).toBe(true);
    }

    expect(isQuoteRequestStatus("draft")).toBe(false);
    expect(isQuoteRequestStatus("deleted")).toBe(false);
    expect(isQuoteRequestStatus("")).toBe(false);
  });

  it("updates the quote and writes previous/new audit values in one SQL statement", async () => {
    const calls: Array<{ query: string; values: readonly unknown[] }> = [];
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: readonly unknown[]) => {
      calls.push({
        query: strings.join("$value").replace(/\s+/g, " ").trim(),
        values,
      });
      return [];
    }) as unknown as QuoteRequestStatusSql;

    await persistQuoteRequestStatusChange({
      sql,
      adminUserId: "admin-user-id",
      requestId: "3bdddf9e-9143-411e-a2c4-152184e8e935",
      nextStatus: "completed",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain("with previous as");
    expect(calls[0]?.query).toContain("for update");
    expect(calls[0]?.query).toContain("update quote_requests");
    expect(calls[0]?.query).toContain("insert into admin_audit_logs");
    expect(calls[0]?.query).toContain("'quote_request.status_updated'");
    expect(calls[0]?.query).toContain("previous_status");
    expect(calls[0]?.query).toContain("next_status");
    expect(calls[0]?.values).toEqual([
      "3bdddf9e-9143-411e-a2c4-152184e8e935",
      "completed",
      "completed",
      "admin-user-id",
    ]);
  });
});
