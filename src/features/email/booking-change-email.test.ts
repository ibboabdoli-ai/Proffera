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
