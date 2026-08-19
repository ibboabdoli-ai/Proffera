import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("preview billing safety contract", () => {
  it("shows configured prices in Stripe Sandbox without inventing a missing Starter price", () => {
    const billingCard = source("src/app/dashboard/installningar/workspace-billing-card.tsx");

    expect(billingCard).toContain('`${plan.priceLabel} · Stripe Sandbox`');
    expect(billingCard).toContain('starterPlan?.configured');
    expect(billingCard).toContain('starterPlan.priceLabel');
    expect(billingCard).toContain('Pris bekräftas i Stripe');
    expect(billingCard).toContain('Professional · {professionalPlan.priceLabel}{testMode ? " (test)" : ""}');
    expect(billingCard).not.toContain('1 kr/mån (test)');
    expect(billingCard).not.toContain('299 kr/mån');
  });

  it("keeps Preview booking links and QR codes on the active Vercel Preview host", () => {
    const bookingCard = source("src/app/dashboard/installningar/booking-link-card.tsx");

    expect(bookingCard).toContain('window.location.hostname.endsWith(".vercel.app")');
    expect(bookingCard).toContain('["proffera.se", "www.proffera.se"]');
    expect(bookingCard).toContain('target.pathname.startsWith("/boka/")');
    expect(bookingCard).toContain('window.location.origin');
    expect(bookingCard).toContain('navigator.clipboard.writeText(resolvedUrl)');
    expect(bookingCard).toContain('QRCode.toDataURL(resolvedUrl');
    expect(bookingCard).toContain('href={resolvedUrl}');
  });
});
