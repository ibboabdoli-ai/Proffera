import { afterEach, describe, expect, it } from "vitest";

import { publicBookingSuccessRedirect } from "@/lib/public-booking-success-redirect";

const originalEnvironment = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalEnvironment;
});

describe("email-verified booking success URLs", () => {
  it("returns Maria customers to approved Design 02 only in Preview", () => {
    process.env.VERCEL_ENV = "preview";
    expect(publicBookingSuccessRedirect("makeup-by-maria", "sv"))
      .toBe("/demo/makeup-by-maria-v2.html?booked=1&lang=sv");
    expect(publicBookingSuccessRedirect("makeup-by-maria", "en"))
      .toBe("/demo/makeup-by-maria-v2.html?booked=1&lang=en");
  });

  it("preserves generic success URL outside Preview", () => {
    process.env.VERCEL_ENV = "production";
    expect(publicBookingSuccessRedirect("makeup-by-maria", "sv"))
      .toBe("/boka/makeup-by-maria?booked=1&lang=sv");
  });

  it("does not affect other businesses or PrimeView", () => {
    process.env.VERCEL_ENV = "preview";
    expect(publicBookingSuccessRedirect("primeview", "en")).toBe("/booking?booked=1");
    expect(publicBookingSuccessRedirect("another-salon", "sv"))
      .toBe("/boka/another-salon?booked=1&lang=sv");
  });
});
