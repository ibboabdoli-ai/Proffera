import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/image", () => ({ default: "img" }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));
vi.mock("@/lib/maria-booking-reference-db", () => ({
  readMariaBookingReference: vi.fn(),
}));
vi.mock("@/lib/maria-preview-booking", () => ({
  getMariaPreviewBookingReadiness: vi.fn(),
}));
vi.mock("@/lib/maria-preview-customer-safety", () => ({
  isMariaPreviewTestRecipient: (email: string) => email === "qa@example.invalid",
}));

import { getSql } from "@/lib/db/server";
import { readMariaBookingReference } from "@/lib/maria-booking-reference-db";
import { getMariaPreviewBookingReadiness } from "@/lib/maria-preview-booking";
import MariaSwishPaymentPage, { metadata as mariaSwishMetadata } from "./page";

const id = "11111111-2222-4333-8444-555555555555";
const props = { params: Promise.resolve({ id }) };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readMariaBookingReference)
    .mockResolvedValue("MBM-11111111222243338444555555555555");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED", "true");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "qa@example.invalid");
  vi.mocked(getMariaPreviewBookingReadiness).mockResolvedValue({
    enabled: true,
    workspaceId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    publicSlug: "makeup-by-maria",
    companyName: "Makeup by Maria",
    ownerEmail: "qa@example.invalid",
    ownerPhone: "",
    primaryCity: "Södertälje",
    timeZone: "Europe/Stockholm",
  });
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Maria Preview first-party Swish payment information page", () => {
  it("clears inherited Proffera PWA and social metadata on the payment route", () => {
    expect(mariaSwishMetadata.manifest).toBeNull();
    expect(mariaSwishMetadata.appleWebApp).toBeNull();
    expect(mariaSwishMetadata.applicationName).toBe("Makeup by Maria");
    expect(new URL(String(mariaSwishMetadata.metadataBase)).origin).toBe("https://makeupbymaria.se");
    expect(mariaSwishMetadata.openGraph).toBeNull();
    expect(mariaSwishMetadata.twitter).toBeNull();
    expect(mariaSwishMetadata.robots).toEqual({index:false,follow:false});
    expect(mariaSwishMetadata.icons).toMatchObject({
      icon: "/demo/makeup-by-maria/assets/maria-client-logo.jpg",
    });
  });

  it("shows a direct untracked Swish action and two accessible copy controls", async () => {
    const sql = vi.fn().mockResolvedValueOnce([{ id }]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    const html = renderToStaticMarkup(await MariaSwishPaymentPage(props));
    expect(html).toContain("MBM-11111111222243338444555555555555");
    expect(html).toContain('class="min-w-0 break-all select-all text-lg font-bold"');
    expect(html).toContain('<code dir="ltr" class="min-w-0 break-all select-all text-lg font-bold">MBM-11111111222243338444555555555555</code>');
    expect(html).toContain("123-581 86 53");
    expect(html).toContain(`${(2000).toLocaleString("sv-SE")} kr`);
    expect(html).toContain("Öppna Swish");
    expect(html).toContain('src="/demo/makeup-by-maria/assets/maria-client-logo.jpg"');
    expect(html).toContain('alt="Makeup by Maria"');
    expect(html).toContain("Endast test");
    expect(html).toContain('aria-label="Kopiera Swish-nummer"');
    expect(html).toContain('aria-label="Kopiera bokningsnummer"');
    expect(html).toContain("https://app.swish.nu/1/p/sw/?sw=1235818653&amp;amt=2000&amp;cur=SEK&amp;msg=MBM-11111111222243338444555555555555&amp;src=qr");
    expect(html).toContain(`/api/makeup-by-maria/swish-qr/${id}`);
    expect(html).not.toContain("sendibt3.com");
    expect(sql).toHaveBeenCalledOnce();
  });

  it("uses a short, immutable booking-specific message instead of the UUID when assigned", async () => {
    vi.mocked(readMariaBookingReference).mockResolvedValueOnce("MBM-2026111001");
    const sql = vi.fn().mockResolvedValueOnce([{ id }]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    const html = renderToStaticMarkup(await MariaSwishPaymentPage(props));
    expect(html).toContain("MBM-2026111001");
    expect(html).toContain("msg=MBM-2026111001");
    expect(html).not.toContain("MBM-11111111222243338444555555555555");
    expect(sql).toHaveBeenCalledOnce();
  });

  it("renders English and Arabic in the requested locale and falls back to Swedish for unknown languages", async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce([{ id }])
      .mockResolvedValueOnce([{ id }])
      .mockResolvedValueOnce([{ id }]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    const english = renderToStaticMarkup(await MariaSwishPaymentPage({
      ...props, searchParams: Promise.resolve({ lang: "en" }),
    }));
    expect(english).toContain('<main lang="en" dir="ltr"');
    expect(english).toContain("Swish deposit");
    expect(english).toContain("Test only. Do not make a real Swish payment");
    expect(english).toContain("Open Swish");
    expect(english).toContain("Business Swish");
    expect(english).toContain("Swish QR code");
    expect(english).toContain('aria-label="Copy Swish number"');
    expect(english).toContain('aria-label="Copy booking number"');
    expect(english).toContain('/maria/swish/' + id + '?lang=en');
    expect(english).toContain('/maria/swish/' + id + '?lang=sv');
    expect(english).not.toContain("sendibt3.com");
    const arabic = renderToStaticMarkup(await MariaSwishPaymentPage({
      ...props, searchParams: Promise.resolve({ lang: "ar" }),
    }));
    expect(arabic).toContain('<main lang="ar" dir="rtl"');
    expect(arabic).toContain("دفع العربون عبر Swish");
    expect(arabic).toContain("فتح Swish");
    expect(arabic).toContain("للاختبار فقط");
    expect(arabic).toContain('aria-label="نسخ رقم Swish"');
    expect(arabic).toContain('aria-label="نسخ رقم الحجز"');
    expect(arabic).toContain("MBM-11111111222243338444555555555555");
    expect(arabic).toContain("123-581 86 53");
    expect(arabic).toContain("/maria/swish/" + id + "?lang=ar");
    expect(arabic).toContain('dir="ltr"');
    expect(arabic).not.toContain("sendibt3.com");
    const fallback = renderToStaticMarkup(await MariaSwishPaymentPage({
      ...props, searchParams: Promise.resolve({ lang: "xx" }),
    }));
    expect(fallback).toContain('<main lang="sv" dir="ltr"');
    expect(fallback).toContain("Swish-handpenning");
    expect(fallback).toContain('aria-label="Kopiera bokningsnummer"');
  });

  it("fails closed for missing Production bookings, invalid IDs and mismatching Preview inboxes", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    vi.stubEnv("VERCEL_ENV", "production");
    // The payment portal must fail closed without an explicit, separate
    // authorization even if a booking UUID exists.
    await expect(MariaSwishPaymentPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(sql).not.toHaveBeenCalled();
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_ORIGIN", "https://makeupbymaria.se");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_SWISH_ENABLED", "true");
    await expect(MariaSwishPaymentPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(sql).toHaveBeenCalledTimes(1);
    sql.mockClear();
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(MariaSwishPaymentPage({ params: Promise.resolve({ id: "invalid" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "other@example.invalid");
    await expect(MariaSwishPaymentPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(sql).not.toHaveBeenCalled();
  });

  it("shows an eligible Production Swish payment without the Preview-only warning", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED", "true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_ORIGIN", "https://makeupbymaria.se");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_SWISH_ENABLED", "true");
    const sql = vi.fn().mockResolvedValueOnce([{ id }]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    const html = renderToStaticMarkup(await MariaSwishPaymentPage(props));
    expect(html).toContain("Swish-handpenning");
    expect(html).not.toContain("Endast test");
    expect(sql).toHaveBeenCalledOnce();
  });

  it("fails closed for missing bookings while keeping SQL scoped to the expected Maria workspace", async () => {
    const missing = vi.fn().mockResolvedValueOnce([]);
    vi.mocked(getSql).mockReturnValue(missing as never);
    await expect(MariaSwishPaymentPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(missing).toHaveBeenCalledOnce();
    const scopedQuery = Array.from(missing.mock.calls[0][0] as TemplateStringsArray).join(" ?");
    expect(scopedQuery).toMatch(/b\.workspace_id=\s*\?/);
    expect(missing.mock.calls[0].slice(1)).toContain("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });
});
