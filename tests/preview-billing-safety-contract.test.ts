import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { BookingLinkCard } from "@/app/dashboard/installningar/booking-link-card";
import { WorkspaceBillingCard } from "@/app/dashboard/installningar/workspace-billing-card";
import { resolveBookingUrlForLocation } from "@/lib/preview-booking-url";

const activeStarterBilling = {
  databaseReady: true,
  status: "active" as const,
  planKey: "starter",
  hasSubscription: true,
  currentPeriodEnd: "2026-09-19T00:00:00.000Z",
  cancelAtPeriodEnd: false,
};

const starterPlan = {
  key: "starter" as const,
  name: "Starter",
  priceLabel: "199 kr/mån",
  description: "Starter test",
  configured: true,
};

const professionalPlan = {
  key: "professional" as const,
  name: "Professional",
  priceLabel: "599 kr/mån",
  description: "Professional test",
  configured: true,
};

function renderBilling(checkoutPlans = [starterPlan, professionalPlan]) {
  return renderToStaticMarkup(createElement(WorkspaceBillingCard, {
    billing: activeStarterBilling,
    canManage: true,
    checkoutConfigured: true,
    testMode: true,
    checkoutPlans,
    preferredPlanKey: null,
    billingCurrency: "SEK",
    timeZone: "Europe/Stockholm",
    locale: "sv",
    adaptivePricingEnabled: false,
  }));
}

describe("preview billing safety behavior", () => {
  it("renders the configured Sandbox Starter and Professional prices", () => {
    const html = renderBilling();

    expect(html).toContain("Starter · 199 kr/mån (test)");
    expect(html).toContain("Professional · 599 kr/mån (test)");
    expect(html).toContain("199 kr/mån · Stripe Sandbox");
    expect(html).toContain("599 kr/mån · Stripe Sandbox");
    expect(html).not.toContain("1 kr/mån (test)");
  });

  it("does not invent a Starter amount when the Starter price is unavailable", () => {
    const html = renderBilling([{ ...starterPlan, configured: false }, professionalPlan]);

    expect(html).toContain("Starter · Pris bekräftas i Stripe (test)");
    expect(html).toContain("Pris bekräftas i Stripe · Stripe Sandbox");
    expect(html).not.toContain("199 kr/mån · Stripe Sandbox");
    expect(html).not.toContain("Starter · 199 kr/mån (test)");
  });

  it("rewrites a canonical production booking URL only when the server marks the deployment as Preview", () => {
    const canonical = "https://www.proffera.se/boka/iboren-preview-test?lang=en#booking-form";

    expect(resolveBookingUrlForLocation(
      canonical,
      true,
      "https://proffera-jhap-preview.vercel.app",
    )).toBe("https://proffera-jhap-preview.vercel.app/boka/iboren-preview-test?lang=en#booking-form");

    expect(resolveBookingUrlForLocation(
      canonical,
      false,
      "https://proffera-jhap-production.vercel.app",
    )).toBe(canonical);
  });

  it("keeps unrelated URLs unchanged even in Preview", () => {
    expect(resolveBookingUrlForLocation(
      "https://example.com/boka/test",
      true,
      "https://preview.vercel.app",
    )).toBe("https://example.com/boka/test");
    expect(resolveBookingUrlForLocation(
      "https://www.proffera.se/dashboard",
      true,
      "https://preview.vercel.app",
    )).toBe("https://www.proffera.se/dashboard");
  });

  it("renders the canonical server snapshot outside Preview", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    try {
      const canonical = "https://www.proffera.se/boka/iboren-preview-test";
      const html = renderToStaticMarkup(createElement(BookingLinkCard, { url: canonical }));

      expect(html).toContain(`href="${canonical}"`);
      expect(html).toContain(canonical);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
