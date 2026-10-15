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
    expect(email.html.toLowerCase()).not.toContain("primeview");
    expect(email.html).toContain("QA &lt;Bride&gt;");
    expect(email.html).toContain(booking.portalUrl);
    expect(email.text).toContain("with Makeup by Maria.");
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
    expect(email.html).toContain("PrimeView Window Care · Powered by Proffera");
  });

  it("does not change Swedish output when Maria branding is selected", () => {
    expect(buildUnifiedBookingConfirmationEmail({ ...booking, language: "sv", branding: "makeup-by-maria" }))
      .toEqual(buildUnifiedBookingConfirmationEmail({ ...booking, language: "sv" }));
  });
});
