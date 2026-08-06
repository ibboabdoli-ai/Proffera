import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildVerifiedReviewInvitationEmail,
  sendVerifiedReviewInvitationEmail,
} from "../src/features/email/review-invitation-email";

const invitation = {
  customerName: "Alex <Customer>",
  customerEmail: "alex@example.com",
  companyName: "Prime & View",
  bookingTitle: "Window <Cleaning>",
  reviewUrl: "https://www.proffera.se/review/secure-token",
  expiresAt: "2026-09-05T10:00:00.000Z",
  language: "en" as const,
  timeZone: "Europe/London",
};

describe("Verified review invitation email", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("builds an English one-time review email and escapes untrusted HTML", () => {
    const email = buildVerifiedReviewInvitationEmail(invitation);

    expect(email.subject).toBe("How did we do? – Prime & View");
    expect(email.text).toContain(invitation.reviewUrl);
    expect(email.text).toContain("secure, one-time review link");
    expect(email.html).toContain("Alex &lt;Customer&gt;");
    expect(email.html).toContain("Prime &amp; View");
    expect(email.html).toContain("Window &lt;Cleaning&gt;");
    expect(email.html).not.toContain("<Customer>");
  });

  it("builds Swedish copy for Swedish workspaces", () => {
    const email = buildVerifiedReviewInvitationEmail({
      ...invitation,
      language: "sv",
    });

    expect(email.subject).toContain("Hur gick det?");
    expect(email.text).toContain("säkra engångslänk");
    expect(email.html).toContain("Lämna ett verifierat omdöme");
  });

  it("sends through Brevo without exposing the token outside the email body", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key");
    vi.stubEnv("LEAD_FROM_EMAIL", "Proffera <no-reply@example.com>");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "review-message" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendVerifiedReviewInvitationEmail(invitation);

    expect(result).toEqual({ ok: true, providerId: "review-message" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    const body = JSON.parse(String(options.body));
    expect(body).toMatchObject({
      sender: { name: "Proffera", email: "no-reply@example.com" },
      to: [{ email: "alex@example.com", name: "Alex <Customer>" }],
      subject: "How did we do? – Prime & View",
    });
    expect(body.textContent).toContain(invitation.reviewUrl);
    expect(body.htmlContent).toContain(invitation.reviewUrl);
  });

  it("fails closed when Brevo is not configured", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("LEAD_FROM_EMAIL", "");

    await expect(sendVerifiedReviewInvitationEmail(invitation)).resolves.toEqual({
      ok: false,
      code: "configuration",
      message: "Brevo is not configured.",
    });
  });
});
