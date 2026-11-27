import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  calendar: vi.fn(), presentation: vi.fn(), readiness: vi.fn(),
  portalBase: vi.fn(), existingBase: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ host: "makeupbymaria.se" }) }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: (url: string) => { throw new Error("NEXT_REDIRECT: " + url); },
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/lib/customer-calendar", () => ({
  getCustomerCalendar: mocks.calendar,
  cancelCustomerCalendarBooking: vi.fn(),
}));
vi.mock("@/lib/customer-portal-language", () => ({
  getCustomerPortalPresentation: mocks.presentation,
  resolveCustomerPortalLanguage: () => "sv",
}));
vi.mock("@/lib/public-site-domains", () => ({
  isCustomerPortalHostAllowedForWorkspace: () => true,
  isPrimeViewHost: () => false,
}));
vi.mock("@/lib/maria-booking-runtime", () => ({ getMariaBookingReadiness: mocks.readiness }));
vi.mock("@/lib/maria-preview-customer-safety", () => ({
  getMariaBookingPortalBase: mocks.portalBase,
  getMariaExistingBookingPortalBase: mocks.existingBase,
}));
import Page from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  mocks.presentation.mockResolvedValue({
    workspaceSlug: "makeup-by-maria", publicBookingSlug: "makeup-by-maria",
    companyName: "Makeup by Maria", primaryColor: "#845363",
    swedishEnabled: true, englishEnabled: true,
  });
  mocks.calendar.mockResolvedValue({
    customer: { id: "11111111-2222-4333-8444-555555555555", name: "Synthetic customer" },
    timeZone: "Europe/Stockholm",
    upcoming: [{ id: "22222222-3333-4444-8555-666666666666",
      title: "Synthetic makeup", service: "Synthetic makeup", city: "Södertälje",
      status: "confirmed", startsAt: new Date(Date.now() + 30*86400000).toISOString(),
      endsAt: new Date(Date.now() + 30*86400000 + 10800000).toISOString(),
    }],
    history: [],
    policy: { customerRescheduleEnabled: true, customerCancelEnabled: true, cancelNoticeHours: 24 },
  });
  mocks.portalBase.mockReturnValue(null);
  mocks.existingBase.mockReturnValue("https://makeupbymaria.se");
  mocks.readiness.mockResolvedValue({ enabled: false });
});

async function renderPage() {
  const page = await Page({
    params: Promise.resolve({ token: "synthetic-test-token" }),
    searchParams: Promise.resolve({ lang: "sv" }),
  });
  return renderToStaticMarkup(page);
}

describe("Maria existing-booking cancellation visibility when new intake is paused", () => {
  it("preserves cancellation and Maria branding but hides rescheduling when lifecycle is authorized", async () => {
    const html = await renderPage();
    expect(html).toContain("Avboka</button>");
    expect(html).not.toContain(">Boka om</a>");
    expect(html).toContain("Ombokning online är tillfälligt stängd");
    expect(html).toContain("Makeup by Maria");
  });

  it("hides cancellation and shows unavailable guidance when existing-lifecycle authorization is revoked", async () => {
    mocks.existingBase.mockReturnValue(null);
    const html = await renderPage();
    expect(html).not.toContain("Avboka</button>");
    expect(html).toContain("Ombokning och avbokning online är tillfälligt stängda");
  });
});
