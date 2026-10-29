import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendBookingVerificationEmail } from "./booking-verification-email";

type EmailPayload = { htmlContent: string; textContent: string; subject: string };
const fixture = {
  customerName: "QA Client",
  customerEmail: "qa@example.invalid",
  companyName: "Makeup by Maria",
  code: "123456",
  language: "sv" as const,
};
let sent: EmailPayload[];

beforeEach(() => {
  sent = [];
  vi.stubEnv("BREVO_API_KEY", "fake-test-key");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "qa.vercel.app");
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
    sent.push(JSON.parse(String(options.body)) as EmailPayload);
    return { ok: true, json: async () => ({ messageId: "fake-test-id" }) };
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Maria verification email branding isolation", () => {
  it("does not brand another workspace solely because its company name matches", async () => {
    expect((await sendBookingVerificationEmail(fixture)).ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.htmlContent).not.toContain("maria-wordmark.png");
    expect(sent[0]!.htmlContent).toContain("Makeup by Maria");
  });

  it("brands explicit Maria mail in Preview but never in Production", async () => {
    expect((await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).ok).toBe(true);
    expect(sent[0]!.htmlContent).toContain(
      "https://qa.vercel.app/demo/makeup-by-maria/assets/maria-wordmark.png",
    );
    expect(sent[0]!.textContent).toContain("123456");
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await sendBookingVerificationEmail({ ...fixture, branding: "makeup-by-maria" })).ok).toBe(true);
    expect(sent[1]!.htmlContent).not.toContain("maria-wordmark.png");
  });

  it("uses the explicit Maria flag even with a renamed display name and Arabic RTL", async () => {
    expect((await sendBookingVerificationEmail({
      ...fixture, companyName: "Maria Studio", branding: "makeup-by-maria", language: "ar",
    })).ok).toBe(true);
    expect(sent[0]!.htmlContent).toContain("maria-wordmark.png");
    expect(sent[0]!.htmlContent).toContain('dir="rtl"');
    expect(sent[0]!.subject).toContain("Maria Studio");
  });
});
