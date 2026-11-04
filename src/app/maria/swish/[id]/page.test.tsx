import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/image", () => ({ default: "img" }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));
vi.mock("@/lib/maria-preview-booking", () => ({
  getMariaPreviewBookingReadiness: vi.fn(),
}));
vi.mock("@/lib/maria-preview-customer-safety", () => ({
  isMariaPreviewTestRecipient: (email: string) => email === "qa@example.invalid",
}));

import { getSql } from "@/lib/db/server";
import { getMariaPreviewBookingReadiness } from "@/lib/maria-preview-booking";
import MariaSwishPaymentPage from "./page";

const id = "11111111-2222-4333-8444-555555555555";
const props = { params: Promise.resolve({ id }) };

beforeEach(() => {
  vi.resetAllMocks();
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
  it("shows a direct untracked Swish action and two accessible copy controls", async () => {
    const sql = vi.fn().mockResolvedValue([{ id }]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    const html = renderToStaticMarkup(await MariaSwishPaymentPage(props));
    expect(html).toContain("MBM-111111");
    expect(html).toContain("123-581 86 53");
    expect(html).toContain("2");
    expect(html).toContain("Öppna Swish");
    expect(html).toContain('src="/demo/makeup-by-maria/assets/maria-client-logo.jpg"');
    expect(html).toContain('alt="Makeup by Maria"');
    expect(html).toContain("Endast test");
    expect(html).toContain('aria-label="Kopiera Swish-nummer"');
    expect(html).toContain('aria-label="Kopiera bokningsnummer"');
    expect(html).toContain("https://app.swish.nu/1/p/sw/?sw=1235818653&amp;amt=2000&amp;cur=SEK&amp;msg=MBM-111111&amp;src=qr");
    expect(html).toContain(`/api/makeup-by-maria/swish-qr/${id}`);
    expect(html).not.toContain("sendibt3.com");
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it("fails closed for production, invalid IDs and mismatching QA inboxes before SQL", async () => {
    const sql = vi.fn();
    vi.mocked(getSql).mockReturnValue(sql as never);
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(MariaSwishPaymentPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(MariaSwishPaymentPage({ params: Promise.resolve({ id: "invalid" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "other@example.invalid");
    await expect(MariaSwishPaymentPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(sql).not.toHaveBeenCalled();
  });

  it("never displays payment details for missing or ambiguous bookings", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    await expect(MariaSwishPaymentPage(props)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(sql).toHaveBeenCalledTimes(1);
  });
});
