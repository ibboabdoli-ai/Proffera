import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  getCustomerPortalPresentation: vi.fn(),
  getCustomerCalendar: vi.fn(),
  cancelCustomerCalendarBooking: vi.fn(),
  getRescheduleBooking: vi.fn(),
  rescheduleCustomerBooking: vi.fn(),
  getAvailableRescheduleSlots: vi.fn(),
  getUpcomingRescheduleDays: vi.fn(),
  verifyPublicBookingCode: vi.fn(),
  resendPublicBookingCode: vi.fn(),
  publicBookingSuccessRedirect: vi.fn(),
  getPublicWorkspaceExperienceSettings: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("next/link", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: ReactNode; [key: string]: unknown }) => React.createElement("a", { ...props, href }, children),
  };
});
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/public-form-protection", () => ({ allowPublicSubmission: vi.fn() }));
vi.mock("@/lib/public-booking-policy", () => ({
  parseLocalDateTime: vi.fn(),
  resolveBookingTimeZone: () => "Europe/Stockholm",
  validatePublicBookingPolicy: vi.fn(),
}));
vi.mock("@/lib/public-booking-verification", () => ({
  beginBookingEmailVerification: vi.fn(),
  verifyPublicBookingCode: mocks.verifyPublicBookingCode,
  resendPublicBookingCode: mocks.resendPublicBookingCode,
}));
vi.mock("@/lib/public-booking-success-redirect", () => ({ publicBookingSuccessRedirect: mocks.publicBookingSuccessRedirect }));
vi.mock("@/lib/workspace-feature-entitlement-db", () => ({ hasWorkspaceFeatureAccessForWorkspace: vi.fn() }));
vi.mock("@/lib/workspace-experience", () => ({ getPublicWorkspaceExperienceSettings: mocks.getPublicWorkspaceExperienceSettings }));
vi.mock("@/lib/booking-theme-templates", () => ({ resolveBookingThemeContent: vi.fn() }));
vi.mock("@/components/service-ai-chat-widget", () => ({ BookingAiChatWidget: () => null }));
vi.mock("@/components/salon/julius-booking-demo", () => ({ JuliusBookingDemo: () => null }));
vi.mock("@/lib/customer-calendar", () => ({
  getCustomerCalendar: mocks.getCustomerCalendar,
  cancelCustomerCalendarBooking: mocks.cancelCustomerCalendarBooking,
}));
vi.mock("@/lib/customer-portal-language", () => ({ getCustomerPortalPresentation: mocks.getCustomerPortalPresentation }));
vi.mock("@/lib/customer-booking-reschedule", () => ({
  getRescheduleBooking: mocks.getRescheduleBooking,
  rescheduleCustomerBooking: mocks.rescheduleCustomerBooking,
}));
vi.mock("@/lib/customer-reschedule-slots", () => ({
  getAvailableRescheduleSlots: mocks.getAvailableRescheduleSlots,
  getUpcomingRescheduleDays: mocks.getUpcomingRescheduleDays,
}));
vi.mock("@/lib/public-site-domains", () => ({ isPrimeViewHost: (host: string | null) => host === "www.primeviewwindowcare.co.uk" }));

import PublicBookingPage from "@/app/boka/[slug]/page";
import VerifyBookingPage from "@/app/boka/verifiera/[id]/page";
import ReschedulePage from "@/app/mina-bokningar/[token]/[bookingId]/boka-om/page";
import CustomerPortalPage from "@/app/mina-bokningar/[token]/page";
import { readableBookingTextColor } from "@/lib/booking-theme-contract";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

type AnyElement = ReactElement<Record<string, unknown>>;

function findElements(node: ReactNode, predicate: (element: AnyElement) => boolean) {
  const found: AnyElement[] = [];
  const visit = (value: ReactNode) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isValidElement(value)) return;
    const element = value as AnyElement;
    if (predicate(element)) found.push(element);
    visit((element.props as { children?: ReactNode }).children);
  };
  visit(node);
  return found;
}

const presentation = {
  companyName: "Nordic Fix AB",
  primaryColor: "#808080",
  publicBookingSlug: "nordic-fix",
  defaultLanguage: "en",
  swedishEnabled: true,
  englishEnabled: true,
  logoUrl: "",
};

const calendar = {
  timeZone: "Europe/Stockholm",
  customer: { name: "Ada" },
  policy: { customerRescheduleEnabled: true, customerCancelEnabled: false, cancelNoticeHours: 24 },
  upcoming: [{
    id: "booking-1",
    title: "Service visit",
    service: "Window cleaning",
    startsAt: "2099-05-14T10:00:00.000Z",
    status: "confirmed",
    city: "Stockholm",
  }],
  history: [],
};

const rescheduleBooking = {
  service: "Window cleaning",
  startsAt: "2099-05-14T10:00:00.000Z",
  timeZone: "Europe/Stockholm",
  staffName: "Alex",
};

const days = [{ date: "2099-05-15", label: "15 maj", shortLabel: "15 maj" }];
const slot = { startsAtLocal: "2099-05-15T11:00", label: "11:00" };

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.getSql.mockReturnValue(null);
  mocks.headers.mockResolvedValue(new Headers({ host: "www.proffera.se" }));
  mocks.redirect.mockImplementation((target: string) => { throw new Error(`redirect:${target}`); });
  mocks.notFound.mockImplementation(() => { throw new Error("not_found"); });
  mocks.getCustomerPortalPresentation.mockResolvedValue(presentation);
  mocks.getCustomerCalendar.mockResolvedValue(calendar);
  mocks.cancelCustomerCalendarBooking.mockResolvedValue({ ok: true });
  mocks.getRescheduleBooking.mockResolvedValue(rescheduleBooking);
  mocks.getUpcomingRescheduleDays.mockReturnValue(days);
  mocks.getAvailableRescheduleSlots.mockResolvedValue([]);
  mocks.rescheduleCustomerBooking.mockResolvedValue({ ok: true });
  mocks.publicBookingSuccessRedirect.mockImplementation((slug: string, locale: string) => `/boka/${slug}?booked=1&lang=${locale}`);
  mocks.getPublicWorkspaceExperienceSettings.mockResolvedValue({
    defaultLanguage: "sv",
    swedishEnabled: true,
    englishEnabled: true,
    primaryColor: "#17452f",
  });
});

describe("public booking human-designed UX contract", () => {
  it("keeps booking policy and verification behavior while replacing the public shell", () => {
    const page = source("src/app/boka/[slug]/page.tsx");
    const styles = source("src/app/boka/[slug]/public-booking-marketplace.module.css");

    expect(page).toContain("validatePublicBookingPolicy");
    expect(page).toContain("allowPublicSubmission");
    expect(page).toContain("beginBookingEmailVerification");
    expect(page).toContain("hasWorkspaceFeatureAccessForWorkspace");
    expect(page).toContain("BookingRequestForm");
    expect(styles).toContain("var(--booking-primary)");
    expect(styles).toContain("prefers-reduced-motion");
  });

  it("renders unavailable booking states in the requested Swedish or English locale", async () => {
    const sv = renderToStaticMarkup(await PublicBookingPage({
      params: Promise.resolve({ slug: "nordic-fix" }),
      searchParams: Promise.resolve({ lang: "sv" }),
    }));
    const en = renderToStaticMarkup(await PublicBookingPage({
      params: Promise.resolve({ slug: "nordic-fix" }),
      searchParams: Promise.resolve({ lang: "en" }),
    }));

    expect(sv).toContain('lang="sv"');
    expect(sv).toContain("Bokning är inte tillgänglig ännu");
    expect(en).toContain('lang="en"');
    expect(en).toContain("Booking is not available yet");
  });

  it("keeps service-first booking ordering and first-available-time behavior", () => {
    const form = source("src/app/boka/[slug]/booking-request-form.tsx");
    const controls = source("src/app/boka/[slug]/booking-theme-controls.css");

    expect(form).toContain("function chooseDefaultService(id: string)");
    expect(form).toContain("const first = firstAvailability.get(id)");
    expect(form).toContain("setDate(first?.date ?? today)");
    expect(form).toContain("data-booking-form=\"default\"");
    expect(controls).toContain("label:nth-of-type(4) { order: 10; }");
    expect(controls).toContain("input[type=\"date\"] { order: 20; }");
    expect(controls).toContain("select[aria-label] { order: 30; }");
  });

  it("keeps real tenant media and published booking data contracts", () => {
    const page = source("src/app/boka/[slug]/page.tsx");

    expect(page).toContain("experience.logoUrl");
    expect(page).toContain("experience.heroImageUrl");
    expect(page).toContain("experience.heroVideoUrl");
    expect(page).toContain("visibleServices");
    expect(page).toContain("publishedHours");
  });

  it("chooses WCAG-readable tenant action text and exposes keyboard focus", () => {
    const portalStyles = source("src/app/mina-bokningar/customer-portal.module.css");

    expect(readableBookingTextColor("#808080")).toBe("#000000");
    expect(readableBookingTextColor("#ffffff")).toBe("#17201a");
    expect(readableBookingTextColor("#0a2e63")).toBe("#ffffff");
    expect(portalStyles).toContain(".slotInput:focus-visible + .slotOption");
    expect(portalStyles).toContain("outline-offset: 2px");
  });

  it("preserves explicit Swedish and English URLs through customer self-service and rescheduling", async () => {
    const svPortal = renderToStaticMarkup(await CustomerPortalPage({
      params: Promise.resolve({ token: "customer-token" }),
      searchParams: Promise.resolve({ lang: "sv" }),
    }));
    const enPortal = renderToStaticMarkup(await CustomerPortalPage({
      params: Promise.resolve({ token: "customer-token" }),
      searchParams: Promise.resolve({ lang: "en" }),
    }));

    expect(svPortal).toContain('href="/mina-bokningar/customer-token?lang=sv"');
    expect(svPortal).toContain('href="/mina-bokningar/customer-token/booking-1/boka-om?lang=sv"');
    expect(enPortal).toContain('href="/mina-bokningar/customer-token?lang=en"');
    expect(enPortal).toContain('href="/mina-bokningar/customer-token/booking-1/boka-om?lang=en"');

    const svReschedule = renderToStaticMarkup(await ReschedulePage({
      params: Promise.resolve({ token: "customer-token", bookingId: "booking-1" }),
      searchParams: Promise.resolve({ lang: "sv" }),
    }));
    const enReschedule = renderToStaticMarkup(await ReschedulePage({
      params: Promise.resolve({ token: "customer-token", bookingId: "booking-1" }),
      searchParams: Promise.resolve({ lang: "en" }),
    }));

    expect(svReschedule).toContain('href="/mina-bokningar/customer-token?lang=sv"');
    expect(svReschedule).toContain('href="/mina-bokningar/customer-token/booking-1/boka-om?lang=sv&amp;date=2099-05-15"');
    expect(enReschedule).toContain('href="/mina-bokningar/customer-token?lang=en"');
    expect(enReschedule).toContain('href="/mina-bokningar/customer-token/booking-1/boka-om?lang=en&amp;date=2099-05-15"');
  });

  it("preserves the active locale in PrimeView redirects", async () => {
    mocks.getCustomerPortalPresentation.mockResolvedValue({ ...presentation, publicBookingSlug: "primeview" });

    await expect(CustomerPortalPage({
      params: Promise.resolve({ token: "customer-token" }),
      searchParams: Promise.resolve({ lang: "sv", changed: "1" }),
    })).rejects.toThrow("redirect:https://www.primeviewwindowcare.co.uk/mina-bokningar/customer-token?lang=sv&changed=1");

    mocks.redirect.mockClear();
    await expect(ReschedulePage({
      params: Promise.resolve({ token: "customer-token", bookingId: "booking-1" }),
      searchParams: Promise.resolve({ lang: "sv", date: "2099-05-15" }),
    })).rejects.toThrow("redirect:https://www.primeviewwindowcare.co.uk/mina-bokningar/customer-token/booking-1/boka-om?lang=sv&date=2099-05-15");
  });

  it("keeps the active locale on rescheduling success and error redirects", async () => {
    mocks.getAvailableRescheduleSlots.mockResolvedValue([slot]);
    const tree = await ReschedulePage({
      params: Promise.resolve({ token: "customer-token", bookingId: "booking-1" }),
      searchParams: Promise.resolve({ lang: "sv" }),
    });
    const picker = findElements(tree, (element) => Array.isArray(element.props.slots) && typeof element.props.action === "function")[0];
    const action = picker.props.action as (formData: FormData) => Promise<void>;
    const formData = new FormData();
    formData.set("startsAtLocal", slot.startsAtLocal);

    mocks.rescheduleCustomerBooking.mockResolvedValueOnce({ ok: false, error: "conflict" });
    await expect(action(formData)).rejects.toThrow("redirect:/mina-bokningar/customer-token/booking-1/boka-om?date=2099-05-15&error=conflict&lang=sv");
    expect(mocks.rescheduleCustomerBooking).toHaveBeenLastCalledWith(
      "customer-token",
      "booking-1",
      slot.startsAtLocal,
      "sv",
    );

    mocks.redirect.mockClear();
    mocks.rescheduleCustomerBooking.mockResolvedValueOnce({ ok: true });
    await expect(action(formData)).rejects.toThrow("redirect:/mina-bokningar/customer-token?changed=1&lang=sv");
  });

  it("propagates only the resolved enabled portal locale through cancellation and booking-change email contracts", () => {
    const portal = source("src/app/mina-bokningar/[token]/page.tsx");
    const reschedulePage = source("src/app/mina-bokningar/[token]/[bookingId]/boka-om/page.tsx");
    const email = source("src/features/email/booking-change-email.ts");
    const reschedule = source("src/lib/customer-booking-reschedule.ts");
    const calendarSource = source("src/lib/customer-calendar.ts");

    expect(portal).toContain('const language = resolvePortalLanguage(String(formData.get("lang") ?? ""), presentation);');
    expect(portal).toContain("cancelCustomerCalendarBooking(token, id, language)");
    expect(reschedulePage).toContain("rescheduleCustomerBooking(token, bookingId, startsAtLocal, language)");
    expect(email).toContain("input.language");
    expect(email).toContain('language: "sv" | "en"');
    expect(reschedule).toContain("language,");
    expect(reschedule).toContain("?lang=${language}");
    expect(calendarSource).toContain("language,");
    expect(calendarSource).toContain("?lang=${language}");
  });

  it("executes verification and resend behavior with localized observable redirects", async () => {
    const verificationId = "11111111-1111-4111-8111-111111111111";
    mocks.getSql.mockReturnValue(async () => [{ workspace_id: "22222222-2222-4222-8222-222222222222" }]);
    const tree = await VerifyBookingPage({
      params: Promise.resolve({ id: verificationId }),
      searchParams: Promise.resolve({ lang: "en", channel: "sms" }),
    });
    const anchors = findElements(tree, (element) => element.type === "a").map((element) => element.props.href);
    const forms = findElements(tree, (element) => element.type === "form");

    expect(anchors).toContain(`/boka/verifiera/${verificationId}?lang=sv&channel=sms`);
    expect(anchors).toContain(`/boka/verifiera/${verificationId}?lang=en&channel=sms`);

    const verifyAction = forms[0].props.action as (formData: FormData) => Promise<void>;
    const resendAction = forms[1].props.action as (formData: FormData) => Promise<void>;
    const verifyData = new FormData();
    verifyData.set("id", verificationId);
    verifyData.set("code", "123456");
    verifyData.set("lang", "en");
    verifyData.set("channel", "sms");

    mocks.verifyPublicBookingCode.mockResolvedValueOnce({ ok: false, error: "code" });
    await expect(verifyAction(verifyData)).rejects.toThrow(`redirect:/boka/verifiera/${verificationId}?error=code&lang=en&channel=sms`);

    mocks.redirect.mockClear();
    mocks.verifyPublicBookingCode.mockResolvedValueOnce({ ok: true, slug: "nordic-fix" });
    await expect(verifyAction(verifyData)).rejects.toThrow("redirect:/boka/nordic-fix?booked=1&lang=en");
    expect(mocks.publicBookingSuccessRedirect).toHaveBeenCalledWith("nordic-fix", "en");

    mocks.redirect.mockClear();
    const resendData = new FormData();
    resendData.set("id", verificationId);
    resendData.set("lang", "en");
    mocks.resendPublicBookingCode.mockResolvedValueOnce({ ok: true, delivery: "email_sms" });
    await expect(resendAction(resendData)).rejects.toThrow(`redirect:/boka/verifiera/${verificationId}?resent=1&lang=en&channel=email_sms`);
  });

  it("renders only enabled verification languages and falls back consistently in actions", async () => {
    const verificationId = "11111111-1111-4111-8111-111111111111";
    mocks.getSql.mockReturnValue(async () => [{ workspace_id: "22222222-2222-4222-8222-222222222222" }]);
    mocks.getPublicWorkspaceExperienceSettings.mockResolvedValue({
      defaultLanguage: "en",
      swedishEnabled: false,
      englishEnabled: true,
      primaryColor: "#ffffff",
    });

    const tree = await VerifyBookingPage({
      params: Promise.resolve({ id: verificationId }),
      searchParams: Promise.resolve({ lang: "sv" }),
    });
    const markup = renderToStaticMarkup(tree);
    const anchors = findElements(tree, (element) => element.type === "a");
    const forms = findElements(tree, (element) => element.type === "form");

    expect(markup).toContain('lang="en"');
    expect(markup).toContain('--booking-primary:#ffffff');
    expect(markup).toContain('--booking-primary-text:#17201a');
    expect(anchors.map((element) => element.props.href)).toEqual([`/boka/verifiera/${verificationId}?lang=en&channel=email`]);

    const resendData = new FormData();
    resendData.set("id", verificationId);
    resendData.set("lang", "sv");
    mocks.resendPublicBookingCode.mockResolvedValueOnce({ ok: true, delivery: "email" });
    await expect((forms[1].props.action as (data: FormData) => Promise<void>)(resendData))
      .rejects.toThrow(`redirect:/boka/verifiera/${verificationId}?resent=1&lang=en&channel=email`);
    expect(mocks.resendPublicBookingCode).toHaveBeenCalledWith(verificationId, "en");
  });

  it("falls back to an enabled Swedish verification experience", async () => {
    const verificationId = "11111111-1111-4111-8111-111111111111";
    mocks.getSql.mockReturnValue(async () => [{ workspace_id: "22222222-2222-4222-8222-222222222222" }]);
    mocks.getPublicWorkspaceExperienceSettings.mockResolvedValue({
      defaultLanguage: "sv",
      swedishEnabled: true,
      englishEnabled: false,
      primaryColor: "#17452f",
    });

    const tree = await VerifyBookingPage({
      params: Promise.resolve({ id: verificationId }),
      searchParams: Promise.resolve({ lang: "en", channel: "sms" }),
    });
    const markup = renderToStaticMarkup(tree);
    const anchors = findElements(tree, (element) => element.type === "a");
    const forms = findElements(tree, (element) => element.type === "form");

    expect(markup).toContain('lang="sv"');
    expect(anchors.map((element) => element.props.href)).toEqual([`/boka/verifiera/${verificationId}?lang=sv&channel=sms`]);

    const verifyData = new FormData();
    verifyData.set("id", verificationId);
    verifyData.set("code", "123456");
    verifyData.set("lang", "en");
    verifyData.set("channel", "sms");
    mocks.verifyPublicBookingCode.mockResolvedValueOnce({ ok: true, slug: "nordic-fix" });
    await expect((forms[0].props.action as (data: FormData) => Promise<void>)(verifyData))
      .rejects.toThrow("redirect:/boka/nordic-fix?booked=1&lang=sv");
    expect(mocks.publicBookingSuccessRedirect).toHaveBeenCalledWith("nordic-fix", "sv");
  });

  it("fails closed to Swedish when verification workspace settings cannot be trusted", async () => {
    const verificationId = "11111111-1111-4111-8111-111111111111";
    mocks.getSql.mockReturnValue(async () => [{ workspace_id: "22222222-2222-4222-8222-222222222222" }]);
    mocks.getPublicWorkspaceExperienceSettings.mockResolvedValue({
      defaultLanguage: "en",
      swedishEnabled: false,
      englishEnabled: false,
      primaryColor: "not-a-color",
    });

    const tree = await VerifyBookingPage({
      params: Promise.resolve({ id: verificationId }),
      searchParams: Promise.resolve({ lang: "en" }),
    });
    const markup = renderToStaticMarkup(tree);
    const anchors = findElements(tree, (element) => element.type === "a");

    expect(markup).toContain('lang="sv"');
    expect(markup).toContain('--booking-primary:#17452f');
    expect(anchors.map((element) => element.props.href)).toEqual([`/boka/verifiera/${verificationId}?lang=sv&channel=email`]);
  });
});
