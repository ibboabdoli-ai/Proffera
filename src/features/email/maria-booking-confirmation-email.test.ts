import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildUnifiedBookingConfirmationEmail } from "./unified-booking-confirmation-email";

const booking = {
  customerName: "QA <Bride>",
  customerEmail: "qa@example.invalid",
  companyName: "Makeup by Maria",
  service: "Bridal makeup",
  startsAt: "2026-12-12T06:00:00.000Z",
  endsAt: "2026-12-12T09:00:00.000Z",
  city: "QA Test City",
  portalUrl: "https://qa.vercel.app/my-bookings/example?lang=en",
  rescheduleUrl: "https://qa.vercel.app/reschedule/example?lang=en",
  language: "en" as const,
};

describe("Maria booking confirmation branding", () => {
  it("uses Maria in English HTML without another tenant's name, logo or footer", () => {
    const email = buildUnifiedBookingConfirmationEmail({ ...booking, branding: "makeup-by-maria" });
    expect(email.html).toContain("Makeup by Maria will confirm the appointment separately.");
    expect(email.html).toContain("Makeup by Maria · Powered by Proffera");
    expect(email.html).toContain('src="https://qa.vercel.app/demo/makeup-by-maria/assets/maria-wordmark.png"');
    expect(email.html).toContain('alt="Makeup by Maria"');
    expect(email.html.toLowerCase()).not.toContain("primeview");
    expect(email.html).toContain("QA &lt;Bride&gt;");
    expect(email.html).toContain(booking.portalUrl);
    expect(email.text).toContain("with Makeup by Maria.");
  });

  it("renders Arabic confirmation with right-to-left customer links and no PrimeView branding", () => {
    const email = buildUnifiedBookingConfirmationEmail({
      ...booking, language: "ar", branding: "makeup-by-maria",
      portalUrl: "https://qa.vercel.app/my-bookings/test?lang=ar",
      rescheduleUrl: "https://qa.vercel.app/reschedule/test?lang=ar",
    });
    expect(email.subject).toContain("تم استلام طلب حجزك");
    expect(email.html).toContain('dir="rtl"');
    expect(email.html).toContain('src="https://qa.vercel.app/demo/makeup-by-maria/assets/maria-wordmark.png"');
    expect(email.html).toContain("إدارة الحجز");
    expect(email.html).toContain("lang=ar");
    expect(email.html.toLowerCase()).not.toContain("primeview");
    expect(email.text).toContain("تغيير الموعد");
  });

  it("escapes Maria's configured company name in the sentence and footer", () => {
    const email = buildUnifiedBookingConfirmationEmail({
      ...booking, companyName: "Maria <&>", branding: "makeup-by-maria",
    });
    expect(email.html).toContain("Maria &lt;&amp;&gt; will confirm");
    expect(email.html).toContain("Maria &lt;&amp;&gt; · Powered by Proffera");
    expect(email.html).not.toContain("Maria <&>");
  });

  it("preserves existing PrimeView English branding when Maria branding is absent", () => {
    const email = buildUnifiedBookingConfirmationEmail({ ...booking, companyName: "PrimeView Window Care" });
    expect(email.html).toContain("PrimeView will confirm the appointment separately.");
    expect(email.html).toContain('alt="PrimeView Window Care"');
    expect(email.html).not.toContain("maria-wordmark.png");
    expect(email.html).toContain("PrimeView Window Care · Powered by Proffera");
  });

  it("renders Maria's Swedish logo and rose header without changing the plain text or other tenants", () => {
    const maria = buildUnifiedBookingConfirmationEmail({
      ...booking, language: "sv", branding: "makeup-by-maria",
    });
    const unbranded = buildUnifiedBookingConfirmationEmail({ ...booking, language: "sv" });
    expect(maria.subject).toEqual(unbranded.subject);
    expect(maria.text).toEqual(unbranded.text);
    expect(maria.html).toContain('src="https://qa.vercel.app/demo/makeup-by-maria/assets/maria-wordmark.png"');
    expect(maria.html).toContain('alt="Makeup by Maria"');
    expect(maria.html).toContain("background:#845363");
    expect(maria.html).toContain("QA &lt;Bride&gt;");
    expect(maria.html).toContain(booking.portalUrl);
    expect(unbranded.html).not.toContain("maria-wordmark.png");
    expect(unbranded.html).toContain("background:#173e2b");
  });
});
