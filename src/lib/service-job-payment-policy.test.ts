import { describe, expect, it } from "vitest";

import { canCreateServiceJobPayment } from "./service-job-payment-policy";

describe("service job payment policy", () => {
  it("allows a positive priced active job", () => {
    expect(canCreateServiceJobPayment({ status: "completed", totalMinor: 12500, currency: "SEK" })).toBe(true);
  });

  it("rejects cancelled or unpriced jobs", () => {
    expect(canCreateServiceJobPayment({ status: "cancelled", totalMinor: 12500, currency: "SEK" })).toBe(false);
    expect(canCreateServiceJobPayment({ status: "new", totalMinor: null, currency: "SEK" })).toBe(false);
    expect(canCreateServiceJobPayment({ status: "new", totalMinor: 0, currency: "SEK" })).toBe(false);
  });
});
