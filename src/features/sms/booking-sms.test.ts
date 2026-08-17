import { afterEach, describe, expect, it, vi } from "vitest";

import {
  sendBookingCustomerSms,
  sendBookingOwnerSms,
  sendBookingVerificationSms,
} from "@/features/sms/booking-sms";

const originalVercelEnv = process.env.VERCEL_ENV;
const originalBrevoApiKey = process.env.BREVO_API_KEY;
const originalBrevoSmsSender = process.env.BREVO_SMS_SENDER;

afterEach(() => {
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;

  if (originalBrevoApiKey === undefined) delete process.env.BREVO_API_KEY;
  else process.env.BREVO_API_KEY = originalBrevoApiKey;

  if (originalBrevoSmsSender === undefined) delete process.env.BREVO_SMS_SENDER;
  else process.env.BREVO_SMS_SENDER = originalBrevoSmsSender;

  vi.unstubAllGlobals();
});

describe("booking SMS Preview safety", () => {
  it("skips every booking SMS path in Vercel Preview without contacting Brevo", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.BREVO_API_KEY = "preview-key";
    process.env.BREVO_SMS_SENDER = "Proffera";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const verificationSv = await sendBookingVerificationSms({
      customerPhone: "+46700000000",
      companyName: "Preview Company",
      code: "123456",
      language: "sv",
    });
    const verificationEn = await sendBookingVerificationSms({
      customerPhone: "+46700000000",
      companyName: "Preview Company",
      code: "123456",
      language: "en",
    });
    const owner = await sendBookingOwnerSms({
      ownerPhone: "+46700000001",
      companyName: "Preview Company",
      customerName: "Preview Customer",
      customerPhone: "+46700000000",
      service: "Preview Service",
      startsAt: "2026-08-17T10:00:00.000Z",
    });
    const customer = await sendBookingCustomerSms({
      customerPhone: "+46700000000",
      companyName: "Preview Company",
      status: "confirmed",
      service: "Preview Service",
      startsAt: "2026-08-17T10:00:00.000Z",
    });

    expect(verificationSv).toMatchObject({
      ok: false,
      skipped: true,
      message: "SMS är avstängt i Vercel Preview.",
    });
    expect(verificationEn).toMatchObject({
      ok: false,
      skipped: true,
      message: "SMS is disabled in Vercel Preview.",
    });
    expect(owner).toMatchObject({
      ok: false,
      skipped: true,
      message: "SMS är avstängt i Vercel Preview.",
    });
    expect(customer).toMatchObject({
      ok: false,
      skipped: true,
      message: "SMS är avstängt i Vercel Preview.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
