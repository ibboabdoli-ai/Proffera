import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendBookingVerificationEmail } from "@/features/email/booking-verification-email";
import { buildUnifiedBookingConfirmationEmail } from "@/features/email/unified-booking-confirmation-email";

const root = process.cwd();
const assetPath = "public/demo/makeup-by-maria/assets/maria-client-logo.jpg";
const logoUrl = "/demo/makeup-by-maria/assets/maria-client-logo.jpg";
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Makeup by Maria client-approved logo in Preview", () => {
  it("ships the customer image as a self-hosted JPEG asset", () => {
    const image = readFileSync(resolve(root, assetPath));
    expect(statSync(resolve(root, assetPath)).size).toBeGreaterThan(50_000);
    expect(Array.from(image.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
  });

  it("uses the same local logo on both portfolio and booking pages", () => {
    const booking = read("public/demo/makeup-by-maria-v2.html");
    const portfolio = read("public/demo/makeup-by-maria.html");
    expect(booking.split(logoUrl).length - 1).toBeGreaterThanOrEqual(4);
    expect(portfolio.split(logoUrl).length - 1).toBeGreaterThanOrEqual(4);
  });

  it("renders Maria logo only for Maria in the unified confirmation builder", () => {
    const input = {
      customerName: "QA Bride", customerEmail: "qa@example.invalid",
      companyName: "Makeup by Maria", service: "Bridal makeup",
      startsAt: "2027-06-18T08:00:00.000Z",
      endsAt: "2027-06-18T11:00:00.000Z",
      city: "Södertälje",
      portalUrl: "https://qa.vercel.app/mina-bokningar/test",
      rescheduleUrl: "https://qa.vercel.app/mina-bokningar/test/boka-om",
    };
    const maria = buildUnifiedBookingConfirmationEmail({ ...input, branding: "makeup-by-maria" });
    const other = buildUnifiedBookingConfirmationEmail({ ...input, companyName: "Other workspace" });
    expect(maria.html).toContain(logoUrl);
    expect(other.html).not.toContain(logoUrl);
  });

  it("sends verification markup with a Maria logo only when Maria Preview branding is active", async () => {
    vi.stubEnv("BREVO_API_KEY", "synthetic-test-key");
    vi.stubEnv("VERCEL_URL", "qa.vercel.app");
    vi.stubEnv("VERCEL_ENV", "preview");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ messageId: "qa-only" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      customerName: "QA Bride", customerEmail: "qa@example.invalid",
      companyName: "Makeup by Maria", code: "123456", language: "sv" as const,
    };
    expect((await sendBookingVerificationEmail({ ...input, branding: "makeup-by-maria" })).ok).toBe(true);
    expect((await sendBookingVerificationEmail({ ...input, companyName: "Other workspace" })).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const mariaEmail = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { htmlContent: string };
    const otherEmail = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { htmlContent: string };
    expect(mariaEmail.htmlContent).toContain(logoUrl);
    expect(otherEmail.htmlContent).not.toContain(logoUrl);
  });
});
