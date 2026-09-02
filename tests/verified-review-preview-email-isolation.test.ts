import { afterEach, describe, expect, it, vi } from "vitest";

import { sendVerifiedReviewInvitationEmail } from "../src/features/email/review-invitation-email";

const invitation = {
  customerName: "Preview Customer",
  customerEmail: "real-customer@example.com",
  companyName: "Integration Rör AB",
  bookingTitle: "Rörmokare",
  reviewUrl: "https://preview.example/review/marketplace/test-token",
  expiresAt: "2030-01-16T10:00:00.000Z",
  language: "sv" as const,
  timeZone: "Europe/Stockholm",
};

describe("Verified review Preview email isolation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the dedicated Preview Brevo key and controlled recipient without a shared key", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "preview-only-key");
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "preview-sink@example.com");
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("LEAD_FROM_EMAIL", "Proffera <no-reply@example.com>");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "preview-review-message" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendVerifiedReviewInvitationEmail(invitation)).resolves.toEqual({
      ok: true,
      providerId: "preview-review-message",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);
    expect(headers.get("api-key")).toBe("preview-only-key");
    const body = JSON.parse(String(options.body));
    expect(body.to).toEqual([{ email: "preview-sink@example.com", name: "Proffera Preview" }]);
    expect(body.to).not.toContainEqual(expect.objectContaining({ email: invitation.customerEmail }));
  });

  it("fails closed when Preview tries to reuse the shared Production Brevo key", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "shared-key");
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "preview-sink@example.com");
    vi.stubEnv("BREVO_API_KEY", "shared-key");
    vi.stubEnv("LEAD_FROM_EMAIL", "Proffera <no-reply@example.com>");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendVerifiedReviewInvitationEmail(invitation)).resolves.toEqual({
      ok: false,
      code: "configuration",
      message: "Brevo is not configured.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the controlled Preview recipient is missing", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "preview-only-key");
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "");
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("LEAD_FROM_EMAIL", "Proffera <no-reply@example.com>");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendVerifiedReviewInvitationEmail(invitation)).resolves.toEqual({
      ok: false,
      code: "configuration",
      message: "Brevo is not configured.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
