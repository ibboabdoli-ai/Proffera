import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildVerifiedReviewInvitationEmail,
  sendVerifiedReviewInvitationEmail,
  type VerifiedReviewInvitationEmailInput,
} from "./verified-review-invitation-email";

const input: VerifiedReviewInvitationEmailInput = {
  customerName: "Ada <Lovelace>",
  customerEmail: "ada@example.com",
  companyName: "Nordic & Service AB",
  service: "Window cleaning",
  reviewUrl: "https://www.proffera.se/review/private-token-123",
  expiresAt: "2026-08-31T12:00:00.000Z",
  language: "en",
  timeZone: "Europe/Stockholm",
  primaryColor: "#17452f",
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

describe("verified review invitation email", () => {
  it("builds localized and escaped customer content", () => {
    const email = buildVerifiedReviewInvitationEmail(input);

    expect(email.subject).toBe("Leave a verified review – Nordic & Service AB");
    expect(email.text).toContain(input.reviewUrl);
    expect(email.text).toContain("can only be used once");
    expect(email.html).toContain("Ada &lt;Lovelace&gt;");
    expect(email.html).toContain("Nordic &amp; Service AB");
    expect(email.html).toContain(`href="${input.reviewUrl}"`);
    expect(email.html).not.toContain("Ada <Lovelace>");
  });

  it("uses the Swedish workspace language", () => {
    const email = buildVerifiedReviewInvitationEmail({ ...input, language: "sv" });

    expect(email.subject).toBe("Lämna ett verifierat omdöme – Nordic & Service AB");
    expect(email.text).toContain("kan bara användas en gång");
    expect(email.html).toContain("Lämna verifierat omdöme");
  });

  it("submits the private link to Brevo with the dedicated tag", async () => {
    process.env.BREVO_API_KEY = "test-key";
    process.env.LEAD_FROM_EMAIL = "Proffera <reviews@proffera.se>";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "provider-123" }), { status: 201 }),
    );
    global.fetch = fetchMock;

    await expect(sendVerifiedReviewInvitationEmail(input)).resolves.toEqual({
      ok: true,
      providerMessageId: "provider-123",
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.to).toEqual([{ email: input.customerEmail, name: input.customerName }]);
    expect(body.tags).toEqual(["verified-review-invitation"]);
    expect(JSON.stringify(body)).toContain("private-token-123");
    expect(JSON.stringify(body)).not.toContain("token_hash");
  });

  it("classifies configuration, provider and network failures", async () => {
    delete process.env.BREVO_API_KEY;
    delete process.env.LEAD_FROM_EMAIL;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await expect(sendVerifiedReviewInvitationEmail(input)).resolves.toEqual({
      ok: false,
      code: "configuration",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.BREVO_API_KEY = "test-key";
    process.env.LEAD_FROM_EMAIL = "Proffera <reviews@proffera.se>";
    global.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 422 }));
    await expect(sendVerifiedReviewInvitationEmail(input)).resolves.toEqual({
      ok: false,
      code: "provider",
    });

    global.fetch = vi.fn().mockRejectedValue(new Error("network detail"));
    await expect(sendVerifiedReviewInvitationEmail(input)).resolves.toEqual({
      ok: false,
      code: "network",
    });
  });
});
