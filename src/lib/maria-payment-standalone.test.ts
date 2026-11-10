import { describe, expect, it } from "vitest";
import { isMariaPaymentStandalonePath, MARIA_PAYMENT_SHELL_HEADER } from "./maria-payment-standalone";

const bookingId = "3dd71085-9f11-49d1-8996-663e3135d115";

describe("Maria payment Preview shell isolation", () => {
  it("matches the exact booking-specific payment page only", () => {
    expect(MARIA_PAYMENT_SHELL_HEADER).toBe("x-proffera-maria-preview-payment-shell");
    expect(isMariaPaymentStandalonePath("/maria/swish/" + bookingId)).toBe(true);
    expect(isMariaPaymentStandalonePath("/maria/swish/" + bookingId.toUpperCase())).toBe(true);
  });

  it.each([
    "/maria/swish",
    "/maria/swish/",
    "/maria/swish/not-a-uuid",
    "/maria/swish/3dd71085-9f11-49d1-8996-663e3135d115/more",
    "/dashboard/maria",
    "/dashboard/bokningar",
    "/demo/makeup-by-maria-v2.html",
    "/boka/makeup-by-maria",
    "/mina-bokningar/test",
    "/",
    "",
  ])("does not strip the normal site shell on %s", (path) => {
    expect(isMariaPaymentStandalonePath(path)).toBe(false);
  });
});
