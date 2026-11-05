import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendBookingChangeEmails } from "./booking-change-email";
import { sendBookingRescheduleEmail } from "./booking-reschedule-email";

const logo = "https://qa.vercel.app/demo/makeup-by-maria/assets/maria-client-logo.jpg";
const base = {
  customerName: "QA Bride",
  customerEmail: "qa@example.invalid",
  companyName: "Makeup by Maria",
  service: "Brudsmink med prov",
  city: "Södertälje",
};

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "qa.vercel.app");
  vi.stubEnv("BREVO_API_KEY", "qa-stub-only");
  vi.stubEnv("LEAD_FROM_EMAIL", "Makeup by Maria <noreply@example.invalid>");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ messageId: "qa-only" }), { status: 201 }),
  ));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Maria-only email logo in booking updates", () => {
  it.each(["rescheduled", "cancelled"] as const)(
    "adds the original logo to customer and owner %s notices in Preview", async (kind) => {
      await sendBookingChangeEmails({
        ...base,
        kind,
        branding: "makeup-by-maria",
        ownerEmail: "qa@example.invalid",
        oldStartsAt: "2026-11-07T07:00:00.000Z",
        oldEndsAt: "2026-11-07T09:00:00.000Z",
        newStartsAt: kind === "rescheduled" ? "2026-11-14T07:00:00.000Z" : undefined,
        newEndsAt: kind === "rescheduled" ? "2026-11-14T09:00:00.000Z" : undefined,
        portalUrl: "https://qa.vercel.app/mina-bokningar/private-test",
        timeZone: "Europe/Stockholm",
        language: "sv",
      });
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
      for (const [, options] of vi.mocked(fetch).mock.calls) {
        const body = JSON.parse(String(options?.body)) as { htmlContent: string };
        expect(body.htmlContent).toContain(logo);
        expect(body.htmlContent).toContain('alt="Makeup by Maria"');
      }
    },
  );

  it("does not show Maria branding for another tenant or outside Preview", async () => {
    const input = {
      ...base,
      kind: "rescheduled" as const,
      oldStartsAt: "2026-11-07T07:00:00.000Z",
      oldEndsAt: "2026-11-07T09:00:00.000Z",
      portalUrl: "https://qa.vercel.app/mina-bokningar/private-test",
      timeZone: "Europe/Stockholm" as const,
      language: "sv" as const,
    };
    await sendBookingChangeEmails({ ...input, companyName: "Another workspace" });
    let body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { htmlContent: string };
    expect(body.htmlContent).not.toContain(logo);
    vi.mocked(fetch).mockClear();
    vi.stubEnv("VERCEL_ENV", "production");
    await sendBookingChangeEmails({ ...input, branding: "makeup-by-maria" });
    body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { htmlContent: string };
    expect(body.htmlContent).not.toContain(logo);
  });

  it("adds the logo to an admin-initiated Maria reschedule, but not another tenant", async () => {
    const input = {
      ...base,
      previousStartsAt: "2026-11-07T07:00:00.000Z",
      startsAt: "2026-11-14T07:00:00.000Z",
      endsAt: "2026-11-14T09:00:00.000Z",
      timeZone: "Europe/Stockholm" as const,
    };
    await sendBookingRescheduleEmail({ ...input, branding: "makeup-by-maria" });
    let body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { htmlContent: string };
    expect(body.htmlContent).toContain(logo);
    vi.mocked(fetch).mockClear();
    await sendBookingRescheduleEmail(input);
    body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { htmlContent: string };
    expect(body.htmlContent).not.toContain(logo);
  });
});
