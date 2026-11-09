import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendBookingChangeEmails } from "./booking-change-email";

const originalApiKey = process.env.BREVO_API_KEY;
const originalFrom = process.env.LEAD_FROM_EMAIL;
const originalFetch = global.fetch;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.BREVO_API_KEY;
  else process.env.BREVO_API_KEY = originalApiKey;
  if (originalFrom === undefined) delete process.env.LEAD_FROM_EMAIL;
  else process.env.LEAD_FROM_EMAIL = originalFrom;
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("booking change email locale", () => {
  it("does not call Brevo after the notification lock signal expires", async () => {
    process.env.BREVO_API_KEY = "synthetic-test-only";
    process.env.LEAD_FROM_EMAIL = "Proffera <noreply@example.invalid>";
    const fetchMock = vi.fn();
    global.fetch = fetchMock;
    const controller = new AbortController();
    controller.abort();
    const result = await sendBookingChangeEmails({
      kind: "rescheduled", branding: "makeup-by-maria",
      customerName: "Synthetic customer", customerEmail: "qa@example.invalid",
      companyName: "Makeup by Maria", service: "Brudsmink",
      oldStartsAt: "2027-06-18T08:00:00.000Z",
      oldEndsAt: "2027-06-18T11:00:00.000Z",
      newStartsAt: "2027-06-19T08:00:00.000Z",
      newEndsAt: "2027-06-19T11:00:00.000Z",
      portalUrl: "https://preview.example.invalid/mina-bokningar/token",
      timeZone: "Europe/Stockholm", language: "sv",
      signal: controller.signal,
    });
    expect(result[0]).toMatchObject({ status: "fulfilled", value: { ok: false, notSent: true } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps an aborted in-flight Brevo request uncertain", async () => {
    process.env.BREVO_API_KEY = "synthetic-test-only";
    process.env.LEAD_FROM_EMAIL = "Proffera <noreply@example.invalid>";
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("Synthetic abort", "AbortError"));
    global.fetch = fetchMock;
    let started = 0;
    const result = await sendBookingChangeEmails({
      kind: "rescheduled", branding: "makeup-by-maria",
      customerName: "Synthetic customer", customerEmail: "qa@example.invalid",
      companyName: "Makeup by Maria", service: "Brudsmink",
      oldStartsAt: "2027-06-18T08:00:00.000Z",
      oldEndsAt: "2027-06-18T11:00:00.000Z",
      newStartsAt: "2027-06-19T08:00:00.000Z",
      newEndsAt: "2027-06-19T11:00:00.000Z",
      portalUrl: "https://preview.example.invalid/mina-bokningar/token",
      timeZone: "Europe/Stockholm", language: "sv",
      onRequestStart: () => { started++; },
    });
    expect(started).toBe(1);
    expect(result[0]).toMatchObject({ status: "fulfilled", value: { ok: false, deliveryUncertain: true } });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ["rescheduled", "en", "Your booking has been rescheduled", "New time:"],
    ["cancelled", "en", "Your booking has been cancelled", "Previous time:"],
    ["rescheduled", "sv", "Din bokningstid har ändrats", "Ny tid:"],
    ["cancelled", "sv", "Din bokning är avbokad", "Tidigare tid:"],
  ] as const)("uses %s customer copy in %s", async (kind, language, subject, content) => {
    process.env.BREVO_API_KEY = "test-key";
    process.env.LEAD_FROM_EMAIL = "Proffera <booking@proffera.se>";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "message-1" }), { status: 201 }),
    );
    global.fetch = fetchMock;

    await sendBookingChangeEmails({
      kind,
      language,
      customerName: "Ada",
      customerEmail: "ada@example.com",
      companyName: "Nordic Fix AB",
      service: "Window cleaning",
      oldStartsAt: "2026-09-21T08:00:00.000Z",
      oldEndsAt: "2026-09-21T09:00:00.000Z",
      newStartsAt: kind === "rescheduled" ? "2026-09-22T08:00:00.000Z" : undefined,
      newEndsAt: kind === "rescheduled" ? "2026-09-22T09:00:00.000Z" : undefined,
      portalUrl: `https://www.proffera.se/mina-bokningar/token?lang=${language}`,
      timeZone: "Europe/Stockholm",
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.subject).toContain(subject);
    expect(body.textContent).toContain(content);
    expect(body.textContent).toContain(`?lang=${language}`);
    expect(body.htmlContent).toContain("Nordic Fix AB");
    expect(body.htmlContent).not.toContain("PrimeView");
  });
});
