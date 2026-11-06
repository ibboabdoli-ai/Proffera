import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendBookingVerificationEmail } from "./booking-verification-email";
import { sendUnifiedBookingConfirmationEmail } from "./unified-booking-confirmation-email";
import { sendBookingRescheduleEmail } from "./booking-reschedule-email";
import { sendBookingChangeEmails } from "./booking-change-email";
import { sendBookingOwnerNotificationEmail } from "./lead-email";

const qa = {
  customerName: "Synthetic QA Bride",
  customerEmail: "qa@example.invalid",
  companyName: "Makeup by Maria",
  service: "Brudsmink med prov",
  city: "Södertälje",
};
const startsAt = "2026-11-20T06:00:00.000Z";
const endsAt = "2026-11-20T08:00:00.000Z";
const portalUrl = "https://qa.vercel.app/mina-bokningar/synthetic";

const senders = [
  {
    name: "OTP verification",
    send: () => sendBookingVerificationEmail({
      ...qa, code: "123456", branding: "makeup-by-maria" as const, language: "sv" as const,
    }),
  },
  {
    name: "verified booking confirmation",
    send: () => sendUnifiedBookingConfirmationEmail({
      ...qa, startsAt, endsAt, portalUrl,
      rescheduleUrl: portalUrl + "/boka-om",
      branding: "makeup-by-maria" as const,
    }),
  },
  {
    name: "manager reschedule",
    send: () => sendBookingRescheduleEmail({
      ...qa, previousStartsAt: startsAt,
      startsAt: "2026-11-21T06:00:00.000Z",
      endsAt: "2026-11-21T08:00:00.000Z",
      branding: "makeup-by-maria" as const,
      timeZone: "Europe/Stockholm" as const,
    }),
  },
  {
    name: "customer change notice",
    send: () => sendBookingChangeEmails({
      ...qa, kind: "rescheduled" as const,
      oldStartsAt: startsAt, oldEndsAt: endsAt,
      newStartsAt: "2026-11-21T06:00:00.000Z",
      newEndsAt: "2026-11-21T08:00:00.000Z",
      portalUrl, ownerEmail: "qa@example.invalid",
      branding: "makeup-by-maria" as const,
      timeZone: "Europe/Stockholm" as const,
      language: "sv" as const,
    }),
  },
  {
    name: "owner notification",
    send: () => sendBookingOwnerNotificationEmail({
      ...qa, ownerEmail: "qa@example.invalid",
      customerPhone: "0700000000", startsAt, endsAt,
      timeZone: "Europe/Stockholm" as const,
    }),
  },
];

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "qa.vercel.app");
  vi.stubEnv("BREVO_API_KEY", undefined);
  vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "synthetic-preview-key-only");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "qa@example.invalid");
  vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "qa@example.invalid");
  vi.stubEnv("LEAD_FROM_EMAIL", "Preview QA <booking@example.invalid>");
  // No real provider egress is allowed in these tests.
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    json: async () => ({ messageId: "synthetic-provider-id" }),
  })));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Maria Preview email credentials stay isolated", () => {
  it.each(senders)("delivers $name using the dedicated key alone", async ({ send }) => {
    await send();
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    for (const [url, init] of calls) {
      expect(url).toBe("https://api.brevo.com/v3/smtp/email");
      expect(init?.headers).toMatchObject({
        "api-key": "synthetic-preview-key-only",
        "Content-Type": "application/json",
      });
      const payload = JSON.parse(String(init?.body)) as {
        to: Array<{ email: string }>;
      };
      expect(payload.to.every((item) => item.email === "qa@example.invalid")).toBe(true);
    }
  });

  it.each(senders)("fails closed for $name if the dedicated key is absent", async ({ send }) => {
    vi.stubEnv("BREVO_API_KEY", "synthetic-shared-key-that-must-not-be-used");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", undefined);
    await send();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an identical shared and Preview API key", async () => {
    vi.stubEnv("BREVO_API_KEY", "same-key");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "same-key");
    await sendBookingVerificationEmail({
      ...qa, code: "123456", branding: "makeup-by-maria",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
