import { describe, expect, it } from "vitest";

import {
  buildBillingAlertQueue,
  detectBillingAlertKind,
} from "../src/lib/admin-billing-alerts";

const now = new Date("2026-08-06T10:00:00.000Z");

function inDays(days: number) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe("admin billing alerts", () => {
  it("detects the configured trial thresholds", () => {
    expect(detectBillingAlertKind({ status: "trialing", currentPeriodEnd: inDays(6.5), now })).toBe("trial_ending_7_days");
    expect(detectBillingAlertKind({ status: "trialing", currentPeriodEnd: inDays(2.5), now })).toBe("trial_ending_3_days");
    expect(detectBillingAlertKind({ status: "trialing", currentPeriodEnd: inDays(0.5), now })).toBe("trial_ending_tomorrow");
    expect(detectBillingAlertKind({ status: "trialing", currentPeriodEnd: inDays(-0.1), now })).toBe("trial_expired");
  });

  it("always prioritizes past due and ignores healthy subscriptions", () => {
    expect(detectBillingAlertKind({ status: "past_due", currentPeriodEnd: null, now })).toBe("past_due");
    expect(detectBillingAlertKind({ status: "active", currentPeriodEnd: inDays(1), now })).toBeNull();
    expect(detectBillingAlertKind({ status: "trialing", currentPeriodEnd: inDays(8), now })).toBeNull();
    expect(detectBillingAlertKind({ status: "trialing", currentPeriodEnd: "invalid", now })).toBeNull();
  });

  it("builds one deterministic idempotency key per workspace, alert and period", () => {
    const workspace = {
      id: "11111111-1111-4111-8111-111111111111",
      company_name: "Example AB",
      subscription_status: "trialing",
      current_period_end: inDays(3),
      stripe_bound: true,
    };

    const first = buildBillingAlertQueue([workspace], now);
    const second = buildBillingAlertQueue([workspace], now);
    const changedPeriod = buildBillingAlertQueue([{ ...workspace, current_period_end: inDays(2) }], now);

    expect(first).toHaveLength(1);
    expect(second[0]?.dedupeKey).toBe(first[0]?.dedupeKey);
    expect(changedPeriod[0]?.dedupeKey).not.toBe(first[0]?.dedupeKey);
    expect(first[0]?.billingSource).toBe("stripe");
  });
});
