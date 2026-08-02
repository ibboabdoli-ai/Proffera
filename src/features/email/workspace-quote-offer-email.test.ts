import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildWorkspaceQuoteOfferEmail,
  sendWorkspaceQuoteOfferEmail,
  type WorkspaceQuoteOfferEmailInput,
} from "./workspace-quote-offer-email";

const input: WorkspaceQuoteOfferEmailInput = {
  customerName: "Ada <Lovelace>",
  customerEmail: "ada@example.com",
  companyName: "Nordic & Service AB",
  quoteReferenceId: "OFF-2026-001",
  title: "Fönsterputsning",
  currency: "SEK",
  totalMinor: 12500,
  validUntil: "2026-08-31",
  offerUrl: "https://www.proffera.se/offert/token-123",
  pdfUrl: "https://www.proffera.se/offert/token-123/pdf",
  pdfFilename: "offert-off-2026-001.pdf",
  pdfBytes: new Uint8Array([37, 80, 68, 70]),
  locale: "sv",
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

describe("workspace quote offer email", () => {
  it("builds an escaped email with secure offer and PDF links", () => {
    const email = buildWorkspaceQuoteOfferEmail(input);

    expect(email.subject).toBe("Din offert från Nordic & Service AB");
    expect(email.text).toContain(input.offerUrl);
    expect(email.text).toContain(input.pdfUrl);
    expect(email.html).toContain("Ada &lt;Lovelace&gt;");
    expect(email.html).toContain("Nordic &amp; Service AB");
    expect(email.html).toContain('href="https://www.proffera.se/offert/token-123/pdf"');
  });

  it("submits the PDF and customer link to Brevo without a persisted token hash", async () => {
    process.env.BREVO_API_KEY = "test-key";
    process.env.LEAD_FROM_EMAIL = "Proffera <offers@proffera.se>";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "provider-123" }), { status: 201 }));
    global.fetch = fetchMock;

    await expect(sendWorkspaceQuoteOfferEmail(input)).resolves.toEqual({ ok: true, providerMessageId: "provider-123" });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.to).toEqual([{ email: "ada@example.com", name: "Ada <Lovelace>" }]);
    expect(body.attachment).toEqual([{ name: "offert-off-2026-001.pdf", content: "JVBERg==" }]);
    expect(body.tags).toEqual(["workspace-quote-offer"]);
    expect(JSON.stringify(body)).toContain("token-123");
    expect(JSON.stringify(body)).not.toContain("public_token_hash");
  });

  it("returns a configuration result without attempting a network call", async () => {
    delete process.env.BREVO_API_KEY;
    delete process.env.LEAD_FROM_EMAIL;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await expect(sendWorkspaceQuoteOfferEmail(input)).resolves.toEqual({ ok: false, code: "configuration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies provider and network failures without exposing provider detail", async () => {
    process.env.BREVO_API_KEY = "test-key";
    process.env.LEAD_FROM_EMAIL = "Proffera <offers@proffera.se>";

    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "provider detail" }), { status: 422 }));
    await expect(sendWorkspaceQuoteOfferEmail(input)).resolves.toEqual({ ok: false, code: "provider" });

    global.fetch = vi.fn().mockRejectedValue(new Error("network detail"));
    await expect(sendWorkspaceQuoteOfferEmail(input)).resolves.toEqual({ ok: false, code: "network" });
  });
});
