import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { BookingLinkCard } from "@/app/dashboard/installningar/booking-link-card";
import { WorkspaceBillingCard } from "@/app/dashboard/installningar/workspace-billing-card";
import { resolveBookingUrlForLocation } from "@/lib/preview-booking-url";
import type { WorkspaceBillingSummary } from "@/lib/workspace-billing";

const activeStarterBilling: WorkspaceBillingSummary = {
  databaseReady: true,
  status: "active",
  planKey: "starter",
  hasSubscription: true,
  currentPeriodEnd: "2026-09-19T00:00:00.000Z",
  cancelAtPeriodEnd: false,
};

const noSubscriptionBilling: WorkspaceBillingSummary = {
  databaseReady: true,
  status: null,
  planKey: null,
  hasSubscription: false,
  currentPeriodEnd: null,
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

function renderBilling(
  checkoutPlans = [starterPlan, professionalPlan],
  billing: WorkspaceBillingSummary = activeStarterBilling,
) {
  return renderToStaticMarkup(createElement(WorkspaceBillingCard, {
    billing,
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
    const upgradeHtml = renderBilling();
    const pickerHtml = renderBilling([starterPlan, professionalPlan], noSubscriptionBilling);

    expect(upgradeHtml).toContain("Starter · 199 kr/mån (test)");
    expect(upgradeHtml).toContain("Professional · 599 kr/mån (test)");
    expect(pickerHtml).toContain("199 kr/mån · Stripe Sandbox");
    expect(pickerHtml).toContain("599 kr/mån · Stripe Sandbox");
    expect(upgradeHtml).not.toContain("1 kr/mån (test)");
    expect(pickerHtml).not.toContain("1 kr/mån (test)");
  });

  it("does not invent a Starter amount when the Starter price is unavailable", () => {
    const unavailableStarter = { ...starterPlan, configured: false };
    const upgradeHtml = renderBilling([unavailableStarter, professionalPlan]);
    const pickerHtml = renderBilling([unavailableStarter, professionalPlan], noSubscriptionBilling);

    expect(upgradeHtml).toContain("Starter · Pris bekräftas i Stripe (test)");
    expect(pickerHtml).toContain("Pris bekräftas i Stripe · Stripe Sandbox");
    expect(pickerHtml).not.toContain("199 kr/mån · Stripe Sandbox");
    expect(upgradeHtml).not.toContain("Starter · 199 kr/mån (test)");
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

  it("renders the canonical server snapshot in Preview before hydration", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
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
