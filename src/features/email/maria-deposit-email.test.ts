import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const dbQuery = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/server", () => ({ getSql: () => (...args: unknown[]) => dbQuery(...args) }));

import { buildMariaBookingStatusEmail, sendMariaBookingStatusEmail } from "./maria-deposit-email";

const booking = {
  bookingId: "00000000-0000-0000-0000-000000000001",
  status: "confirmed" as const,
  customerName: "QA <Bride>",
  customerEmail: "qa@example.invalid",
  companyName: "Makeup by Maria",
  service: "Brudsmink med prov 2027",
  startsAt: "2027-06-18T08:00:00.000Z",
  endsAt: "2027-06-18T11:00:00.000Z",
  city: "Södertälje",
  timeZone: "Europe/Stockholm" as const,
  confirmedAt: new Date("2026-11-02T15:00:00.000Z"),
};

beforeEach(() => {
  dbQuery.mockReset().mockResolvedValue([{ deposit_state: "unverified" }]);
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "qa.vercel.app");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "qa@example.invalid");
  vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "qa@example.invalid");
  vi.stubEnv("BREVO_API_KEY", "qa-fake-test-only");
  vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "qa-isolated-stub-only");
  vi.stubEnv("LEAD_FROM_EMAIL", "Makeup by Maria <noreply@example.invalid>");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Maria-only Swish confirmation and cancellation email", () => {
  it("shows 2000 SEK, the 24h deadline, booking-specific QR and unique payment reference", () => {
    const result = buildMariaBookingStatusEmail(booking, "https://qa.vercel.app");
    expect(result.reference).toBe("MBM-00000000000000000000000000000001");
    expect(result.html).toContain('src="https://qa.vercel.app/demo/makeup-by-maria/assets/maria-client-logo.jpg"');
    expect(result.html).toContain('alt="Makeup by Maria"');
    expect(result.html.indexOf("maria-client-logo.jpg")).toBeLessThan(result.html.indexOf("Din bokning är bekräftad"));
    expect(result.text).toContain("2 000 kr");
    expect(result.text).toContain("24 timmar");
    expect(result.text).toContain("123-581 86 53");
    expect(result.text).toContain("senast tisdag 3 november 2026");
    expect(result.text).toContain("Meddelande: MBM-00000000000000000000000000000001");
    expect(result.text.match(/Kontrollera alltid mottagaren i Swish/g)).toHaveLength(1);
    expect(result.html).toContain('src="https://qa.vercel.app/api/makeup-by-maria/swish-qr/00000000-0000-0000-0000-000000000001"');
    expect(result.html).toContain('href="https://qa.vercel.app/maria/swish/00000000-0000-0000-0000-000000000001"');
    expect(result.text).toContain("Visa betalningsuppgifter: https://qa.vercel.app/maria/swish/00000000-0000-0000-0000-000000000001");
    expect(result.html).not.toContain("app.swish.nu");
    expect(result.html).toContain("Sidan visar en direkt Swish-knapp");
    expect(result.html).toContain("QR-koden fyller i mottagare");
    expect(result.text).toContain("Avbokning sker inte automatiskt");
    expect(result.html).toContain("QA &lt;Bride&gt;");
    expect(result.html).not.toContain("<Bride>");
  });

  it("sends a friendly manual cancellation without deposit demands", () => {
    const result = buildMariaBookingStatusEmail({ ...booking, status: "cancelled" }, "https://qa.vercel.app");
    expect(result.subject).toContain("Din bokning är avbokad");
    expect(result.text).toContain("Du får gärna komma tillbaka med en ny bokning.");
    expect(result.text).toContain("MBM-00000000000000000000000000000001");
    expect(result.text).not.toContain("Handpenning");
    expect(result.html).not.toContain("/api/makeup-by-maria/swish-qr/");
    expect(result.html).toContain('src="https://qa.vercel.app/demo/makeup-by-maria/assets/maria-client-logo.jpg"');
    expect(result.html.indexOf("maria-client-logo.jpg")).toBeLessThan(result.html.indexOf("Din bokning är avbokad"));
  });

  it("uses the customer's English language for both manual status emails", () => {
    const confirmed = buildMariaBookingStatusEmail({ ...booking, language: "en" }, "https://qa.vercel.app");
    expect(confirmed.subject).toContain("Your booking is confirmed");
    expect(confirmed.text).toContain("Pay within 24 hours");
    expect(confirmed.text).toContain("Preview test only");
    expect(confirmed.html).toContain('lang="en"');
    expect(confirmed.html).toContain("QA &lt;Bride&gt;");
    expect(confirmed.html).toContain("/api/makeup-by-maria/swish-qr/");
    expect(confirmed.html).not.toContain("app.swish.nu");
    const cancelled = buildMariaBookingStatusEmail({ ...booking, status: "cancelled", language: "en" }, "https://qa.vercel.app");
    expect(cancelled.subject).toContain("Your booking has been cancelled");
    expect(cancelled.html).not.toContain("/api/makeup-by-maria/swish-qr/");
    expect(cancelled.text).not.toContain("Deposit:");
  });

  it("uses Gregorian Arabic dates and RTL copy for both manual status emails", () => {
    const confirmed = buildMariaBookingStatusEmail({ ...booking, language: "ar" }, "https://qa.vercel.app");
    expect(confirmed.subject).toContain("تم تأكيد حجزك");
    expect(confirmed.text).toContain("٢٤ ساعة");
    expect(confirmed.html).toContain('lang="ar" dir="rtl"');
    expect(confirmed.text).toMatch(/٢٠٢٧|2027/);
    expect(confirmed.html).toContain("https://qa.vercel.app/maria/swish/00000000-0000-0000-0000-000000000001?lang=en");
    expect(confirmed.text).toContain("https://qa.vercel.app/maria/swish/00000000-0000-0000-0000-000000000001?lang=en");
    expect(confirmed.html).not.toContain("app.swish.nu");
    const cancelled = buildMariaBookingStatusEmail({ ...booking, status: "cancelled", language: "ar" }, "https://qa.vercel.app");
    expect(cancelled.subject).toContain("تم إلغاء حجزك");
    expect(cancelled.html).not.toContain("/api/makeup-by-maria/swish-qr/");
  });

  it.each(["sv", "en", "ar"] as const)("does not request Swish again after a manually paid booking (%s)", (language) => {
    const output = buildMariaBookingStatusEmail({ ...booking, language, depositAlreadyPaid: true }, "https://qa.vercel.app");
    expect(output.html).not.toContain("/api/makeup-by-maria/swish-qr/");
    expect(output.html).not.toContain("/maria/swish/");
    expect(output.text).not.toContain("123-581 86 53");
    expect(output.text).not.toContain("24 timmar");
    expect(output.text).not.toContain("Pay within 24 hours");
    expect(output.text).not.toContain("يُدفع خلال");
    expect(output.text).toContain("MBM-00000000000000000000000000000001");
  });

  it("permits only Preview manager-created QA bookings as an additional status-mail source", async () => {
    const fetchMock=vi.fn().mockResolvedValue({ok:true});
    vi.stubGlobal("fetch",fetchMock);
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ok:true});
    const [parts,...values]=dbQuery.mock.calls[0] as [TemplateStringsArray,...unknown[]];
    const sqlText=parts.join(" ? ");
    expect(sqlText).toContain("b.source='public_booking'");
    expect(sqlText).toContain("b.source='dashboard_manual'");
    expect(values).toContain(true);
    expect(values).toContain("confirmed");
    expect(values).toContain("qa@example.invalid");
    vi.stubEnv("VERCEL_ENV","production");
    const before=dbQuery.mock.calls.length;
    await sendMariaBookingStatusEmail(booking);
    expect(dbQuery.mock.calls.length).toBe(before);
  });

  it("checks status update revision and appointment times before Brevo delivery", async () => {
    const fetchMock=vi.fn().mockResolvedValue({ok:true});
    vi.stubGlobal("fetch",fetchMock);
    const expectedRevision="2026-11-08T09:00:00.123Z";
    expect(await sendMariaBookingStatusEmail({...booking,expectedRevision})).toEqual({ok:true});
    const [parts,...values]=dbQuery.mock.calls[0] as [TemplateStringsArray,...unknown[]];
    const sqlText=parts.join("?");
    expect(sqlText).toContain("b.starts_at=?::timestamptz");
    expect(sqlText).toContain("b.ends_at=?::timestamptz");
    expect(sqlText).toContain("date_trunc('milliseconds',b.updated_at)=?::timestamptz");
    expect(values).toContain(expectedRevision);
    expect(values).toContain(booking.startsAt);
    expect(values).toContain(booking.endsAt);
  });

  it("reads the latest booking-scoped manual payment state before sending a confirmation", async () => {
    dbQuery.mockResolvedValueOnce([{ deposit_state: "paid" }]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ ok: true });
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as {
      htmlContent: string; textContent: string;
    };
    expect(dbQuery).toHaveBeenCalledOnce();
    expect(sent.htmlContent).not.toContain("/api/makeup-by-maria/swish-qr/");
    expect(sent.textContent).toContain("handpenningen som mottagen");
  });

  it("normalizes the configured display-name sender before emailing a deposit", async () => {
    vi.stubEnv("LEAD_FROM_EMAIL", "Makeup by Maria <noreply@example.invalid>  ");
    const fetchMock = vi.fn().mockResolvedValue({ok:true});
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ok:true});
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {sender:{name:string;email:string}};
    expect(sent.sender).toEqual({name:"Makeup by Maria",email:"noreply@example.invalid"});
  });

  it("sends with only the dedicated Preview Brevo credential", async () => {
    vi.stubEnv("BREVO_API_KEY", "shared-production-credential");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![1].headers["api-key"]).toBe("qa-isolated-stub-only");
  });

  it("does not fall back to the shared key when the Preview key is missing or reused", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "");
    expect(await sendMariaBookingStatusEmail(booking))
      .toEqual({ ok: false, error: "email_not_configured" });
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "qa-fake-test-only");
    expect(await sendMariaBookingStatusEmail(booking))
      .toEqual({ ok: false, error: "email_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dbQuery).not.toHaveBeenCalled();
  });

  it("allows an isolated Preview key even without a shared Production credential", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ ok: true });
    expect(fetchMock.mock.calls[0]![1].headers["api-key"]).toBe("qa-isolated-stub-only");
  });

  it("fails closed if the manual Swish state cannot be read", async () => {
    dbQuery.mockResolvedValueOnce([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ ok: false, error: "invalid_booking" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malicious or non-preview QR image origin", () => {
    expect(() => buildMariaBookingStatusEmail(booking, "https://qa.vercel.app.evil.test")).toThrow("INVALID_MARIA_BOOKING_ORIGIN");
    expect(() => buildMariaBookingStatusEmail(booking, "http://qa.vercel.app")).toThrow("INVALID_MARIA_BOOKING_ORIGIN");
  });

  it("never contacts Brevo when the approved QA recipient changes or is disabled", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "new@example.invalid");
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ ok: false, error: "recipient_not_approved" });
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "");
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ ok: false, error: "recipient_not_approved" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send if the effective Brevo Preview inbox is different", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "different@example.invalid");
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ ok: false, error: "recipient_not_approved" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never sends from Production, even for matching addresses", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ ok: false, error: "recipient_not_approved" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends an existing cancellation during an authorized Production intake pause, not a deposit request", async () => {
    vi.stubEnv("VERCEL_ENV","production");
    vi.stubEnv("PROFFERA_MARIA_PUBLIC_SITE_ENABLED","true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED","true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED","true");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_ORIGIN","https://makeupbymaria.se");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED","false");
    vi.stubEnv("PROFFERA_MARIA_PRODUCTION_SWISH_ENABLED","false");
    const fetchMock=vi.fn().mockResolvedValue({ok:true});
    vi.stubGlobal("fetch",fetchMock);
    expect(await sendMariaBookingStatusEmail({...booking,status:"cancelled"}))
      .toEqual({ok:true});
    const delivered=JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(delivered.htmlContent).not.toContain("/api/makeup-by-maria/swish-qr/");
    expect(delivered.textContent).not.toContain("2 000 kr");
    expect(await sendMariaBookingStatusEmail(booking))
      .toEqual({ok:false,error:"recipient_not_approved"});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not send a stale deposit request if the booking was cancelled", async () => {
    dbQuery.mockResolvedValueOnce([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMariaBookingStatusEmail(booking))
      .toEqual({ ok: false, error: "invalid_booking" });
    expect(fetchMock).not.toHaveBeenCalled();
    const [parts, ...args] = dbQuery.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(parts.join("?")).toContain("and b.status=?");
    expect(args).toContain("confirmed");
  });

  it("does not resend a stale cancellation email to a reactivated booking", async () => {
    dbQuery.mockResolvedValueOnce([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMariaBookingStatusEmail({ ...booking, status: "cancelled" }))
      .toEqual({ ok: false, error: "invalid_booking" });
    expect(fetchMock).not.toHaveBeenCalled();
    const [parts, ...args] = dbQuery.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(parts.join("?")).toContain("and b.status=?");
    expect(args).toContain("cancelled");
  });

  it("sends only to the allowed QA inbox with correct booking reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0]![1].body as string) as {
      to: Array<{email: string}>; htmlContent: string; textContent: string;
    };
    expect(payload.to[0]?.email).toBe("qa@example.invalid");
    expect(payload.htmlContent).toContain("/api/makeup-by-maria/swish-qr/");
    expect(payload.htmlContent).toContain("/maria/swish/");
    expect(payload.htmlContent).not.toContain("app.swish.nu");
    expect(payload.textContent).toContain("MBM-00000000000000000000000000000001");
  });

  it("reports provider errors without assuming payment or delivery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await sendMariaBookingStatusEmail(booking)).toEqual({ ok: false, error: "email_provider_rejected" });
  });
});
