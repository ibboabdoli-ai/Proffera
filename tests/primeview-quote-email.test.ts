import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPrimeViewQuoteConfirmationEmail, buildPrimeViewQuoteOwnerEmail, sendPrimeViewQuoteEmails } from "../src/features/email/lead-email";
import { primeViewQuoteSchema } from "../src/features/primeview/quote";

const quote = {
  name: "Alex & Sam",
  phone: "07500 338 585",
  email: "alex@example.com",
  postcode: "NW1 6XE",
  service: "Gutter Cleaning",
  message: '<script>alert("not markup")</script>',
  website: "",
  formStartedAt: Date.now() - 5_000,
};

describe("PrimeView quote delivery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts the supported public quote fields", () => {
    expect(primeViewQuoteSchema.safeParse(quote).success).toBe(true);
  });

  it("rejects a service that is not offered by PrimeView", () => {
    expect(primeViewQuoteSchema.safeParse({ ...quote, service: "Roof replacement" }).success).toBe(false);
  });

  it("builds a readable owner email and escapes untrusted HTML", () => {
    const email = buildPrimeViewQuoteOwnerEmail(quote);

    expect(email.subject).toBe("New website quote request – Gutter Cleaning");
    expect(email.text).toContain("Name: Alex & Sam");
    expect(email.text).toContain("Postcode: NW1 6XE");
    expect(email.html).toContain("Alex &amp; Sam");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
  });

  it("builds a customer confirmation for the selected service", () => {
    const email = buildPrimeViewQuoteConfirmationEmail(quote);

    expect(email.subject).toContain("PrimeView Window Care");
    expect(email.text).toContain("Gutter Cleaning");
    expect(email.html).toContain("Thank you for contacting");
  });

  it("sends the owner email first and then the customer confirmation", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key");
    vi.stubEnv("LEAD_FROM_EMAIL", "Proffera <no-reply@example.com>");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ messageId: "owner-message" }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messageId: "customer-message" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendPrimeViewQuoteEmails({
      quote,
      recipient: { name: "PrimeView Window Care", email: "am@primeviewlondon.co.uk" },
    });

    expect(result).toMatchObject({ ok: true, confirmationSent: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, ownerOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [, customerOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(ownerOptions.body))).toMatchObject({
      to: [{ email: "am@primeviewlondon.co.uk", name: "PrimeView Window Care" }],
      replyTo: { email: "alex@example.com", name: "Alex & Sam" },
    });
    expect(JSON.parse(String(customerOptions.body))).toMatchObject({
      to: [{ email: "alex@example.com", name: "Alex & Sam" }],
      replyTo: { email: "am@primeviewlondon.co.uk", name: "PrimeView Window Care" },
    });
  });
});
