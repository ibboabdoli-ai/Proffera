import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildVerifiedReviewInvitationEmail,
  sendVerifiedReviewInvitationEmail,
  type SendVerifiedReviewInvitationEmailInput,
} from "./review-invitation-email";

const primeViewInput: SendVerifiedReviewInvitationEmailInput = {
  customerName: "Alex Customer",
  customerEmail: "alex@example.com",
  companyName: "PrimeView Window Care",
  bookingTitle: "Window Cleaning",
  reviewUrl: "https://www.primeviewwindowcare.co.uk/review/secure-token",
  expiresAt: "2026-08-20T18:00:00.000Z",
  language: "sv",
  timeZone: "Europe/Stockholm",
};

const originalApiKey = process.env.BREVO_API_KEY;
const originalFrom = process.env.LEAD_FROM_EMAIL;
const originalFetch = global.fetch;

function restoreEnvironment(name: "BREVO_API_KEY" | "LEAD_FROM_EMAIL", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnvironment("BREVO_API_KEY", originalApiKey);
  restoreEnvironment("LEAD_FROM_EMAIL", originalFrom);
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("PrimeView review invitation email", () => {
  it("always uses PrimeView English branding and includes Google plus verified review links", () => {
    const email = buildVerifiedReviewInvitationEmail(primeViewInput);

    expect(email.subject).toBe("How did we do? Leave a review – PrimeView Window Care");
    expect(email.text).toContain("Leave a Google review:");
    expect(email.text).toContain("google.com/maps/place/PrimeView+Window+Care");
    expect(email.text).toContain(primeViewInput.reviewUrl);
    expect(email.html).toContain("Leave a Google review");
    expect(email.html).toContain("Leave a verified review");
    expect(email.html).toContain("PrimeView Window Care");
    expect(email.html).not.toContain("Tack för att du valde");
  });

  it("sends PrimeView sender branding and reply-to details through Brevo", async () => {
    process.env.BREVO_API_KEY = "test-key";
    process.env.LEAD_FROM_EMAIL = "Proffera <notifications@proffera.se>";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "review-123" }), { status: 201 }),
    );
    global.fetch = fetchMock;

    await expect(sendVerifiedReviewInvitationEmail(primeViewInput)).resolves.toEqual({
      ok: true,
      providerId: "review-123",
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.sender).toEqual({ name: "PrimeView Window Care", email: "notifications@proffera.se" });
    expect(body.replyTo).toEqual({ name: "PrimeView Window Care", email: "am@primeviewlondon.co.uk" });
    expect(body.htmlContent).toContain("Leave a Google review");
    expect(body.htmlContent).toContain(primeViewInput.reviewUrl);
  });
});
