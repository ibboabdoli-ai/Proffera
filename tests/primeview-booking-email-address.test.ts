import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildBookingOwnerNotificationEmail } from "../src/features/email/lead-email";
import { buildUnifiedBookingConfirmationEmail } from "../src/features/email/unified-booking-confirmation-email";

const address = "Flat, Cricket Pavilion, Staveley Road, London";
const postcode = "W4 3ES";

describe("PrimeView booking emails", () => {
  it("sends the workspace owner an English notification with the exact address and postcode", () => {
    const email = buildBookingOwnerNotificationEmail({
      ownerEmail: "owner@example.com",
      companyName: "PrimeView Window Care",
      customerName: "Andrew Clark",
      customerEmail: "andy.clark@example.co.uk",
      customerPhone: "07973311643",
      service: "Window Cleaning",
      startsAt: "2026-09-01T10:00:00.000Z",
      endsAt: "2026-09-01T11:00:00.000Z",
      city: "London",
      address,
      postcode,
      timeZone: "Europe/London",
      language: "en",
    });

    expect(email.subject).toBe("New booking request – Window Cleaning");
    expect(email.text).toContain("Hello PrimeView Window Care,");
    expect(email.text).toContain(`Address: ${address}`);
    expect(email.text).toContain(`Postcode: ${postcode}`);
    expect(email.text).toMatch(/Tuesday.*1 September 2026.*11:00/);
    expect(email.text).not.toContain("Ny bokningsförfrågan");
    expect(email.html).toContain("<strong>Address:</strong>");
    expect(email.html).toContain(postcode);
  });

  it("includes the exact address and postcode in the English customer confirmation", () => {
    const email = buildUnifiedBookingConfirmationEmail({
      customerName: "Andrew Clark",
      customerEmail: "andy.clark@example.co.uk",
      companyName: "PrimeView Window Care",
      service: "Window Cleaning",
      startsAt: "2026-09-01T10:00:00.000Z",
      endsAt: "2026-09-01T11:00:00.000Z",
      city: "London",
      address,
      postcode,
      timeZone: "Europe/London",
      portalUrl: "https://www.primeviewwindowcare.co.uk/my-bookings/example",
      rescheduleUrl: "https://www.primeviewwindowcare.co.uk/my-bookings/example/reschedule",
      language: "en",
    });

    expect(email.subject).toBe("Booking request received – PrimeView Window Care");
    expect(email.text).toContain(`Address: ${address}`);
    expect(email.text).toContain(`Postcode: ${postcode}`);
    expect(email.text).toContain("Area: London");
    expect(email.html).toContain('<td style="padding:6px 16px;font-weight:700;color:#183e63;">Address</td>');
    expect(email.html).toContain(postcode);
  });
});
