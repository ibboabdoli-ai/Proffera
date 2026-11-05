import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Maria per-year copy and manual booking controls", () => {
  it("exposes per-year text and price fields plus existing booking actions", () => {
    const page = read("src/app/dashboard/maria/page.tsx");
    expect(page).toContain('name="trial_description"');
    expect(page).toContain('name="without_description"');
    expect(page).toContain('href="/dashboard/bokningar/blockera"');
    expect(page).toContain('href="/dashboard/bokningar"');
    expect(page).toContain('step="0.01"');
    expect(page).toContain('id="maria-year"');
    expect(page).toContain('const editHours = [5,6,0]');
    expect(page).toContain('id="tider"');
    expect(page).toContain('id="priser"');
  });
  it("scopes public copy to Maria services and does not expose customer data", () => {
    const api = read("src/app/api/makeup-by-maria/config/route.ts");
    expect(api).toContain("short_description");
    expect(api).toContain("trialDescription:");
    expect(api).toContain("withoutDescription:");
    expect(api).toContain("public_slug ~ '^maria-bridal-");
    expect(api).not.toContain("customer_email");
    expect(api).toContain("weekday in (0, 5, 6)");
    expect(api).toContain("no-store");
  });
  it("renders the Swedish copy without changing other-language translations", () => {
    const page = read("public/demo/makeup-by-maria-v2.html");
    expect(page).toContain('if(state.lang==="sv"&&state.year)');
    expect(page).toContain('textContent=details.trialDescription');
    expect(page).toContain('textContent=details.withoutDescription');
    expect(page).toContain('[0,5,6].includes(weekday)');
    expect(page).toContain('cache:"no-store"');
  });
  it("keeps Maria-specific editing in the isolated Preview environment", () => {
    expect(read("src/app/dashboard/maria/page.tsx")).toContain('process.env.VERCEL_ENV !== "preview"');
    expect(read("src/app/dashboard/maria/actions.ts")).toContain('process.env.VERCEL_ENV !== "preview"');
    expect(read("src/app/dashboard/maria/schedule-actions.ts")).toContain('process.env.VERCEL_ENV !== "preview"');
    expect(read("src/lib/maria-dashboard-reschedule.ts")).toContain("pg_advisory_xact_lock");
    expect(read("src/lib/maria-dashboard-reschedule.ts")).toContain("public_booking_verifications hold");
  });

  it("uses bounded request parsing and Stockholm booking times", () => {
    const route = read("src/app/api/makeup-by-maria/booking/route.ts");
    expect(route).toContain("request.body.getReader()");
    expect(route).toContain("reader.cancel()");
    expect(route).toContain("received > 8192");
    expect(route).not.toContain("request.text()");
    expect(route).toContain('const timeZone = "Europe/Stockholm" as const');
  });

  it("prevents a forged completion notice and shows persisted payment status only", () => {
    const design = read("public/demo/makeup-by-maria-v2.html");
    const list = read("src/app/dashboard/bokningar/page.tsx");
    const detail = read("src/app/dashboard/bokningar/[id]/page.tsx");
    expect(design).toContain('sv:{title:"Bokningsinformation"');
    expect(design).not.toContain('title:"Tack! Din e-post är verifierad."');
    expect(list).not.toContain('params?.payment_saved === "paid"');
    expect(detail).not.toContain('value("payment_saved") === "paid"');
    expect(detail).toContain("readMariaSwishQrEligibility(booking.id)");
    expect(detail).toContain('mariaQrEligibility === "eligible"');
  });

  it("lets Maria select a readable duration manually and lists reschedule slots using the saved length", () => {
    const page = read("src/app/dashboard/maria/page.tsx");
    const picker = read("src/lib/customer-reschedule-slots.ts");
    expect(page).toContain("Hur lång tid tar sminkningen?");
    expect(page).toContain('select name="duration_minutes"');
    expect(page).toContain("Ändringen gäller nya bokningar.");
    expect(page).toContain("Befintliga bokningar behåller sin sparade behandlingstid");
    expect(picker).toContain("extract(epoch from (b.ends_at - b.starts_at)) / 60 as booked_duration_minutes");
    expect(picker).toContain("Number.isInteger(bookedDurationMinutes)");
    expect(picker).toContain("durationOverrideMinutes: bookedDurationMinutes");
    expect(picker).toContain("excludeBookingId: bookingId");
  });

  it("fails closed if a manual calendar action has not been explicitly confirmed", () => {
    const button = read("src/app/dashboard/maria/kalender/maria-calendar-confirm-button.tsx");
    const calendar = read("src/app/dashboard/maria/kalender/page.tsx");
    const engine = read("src/lib/maria-manual-calendar.ts");
    expect(button).toContain('name="confirmed" defaultValue="no"');
    expect(button).toContain('input.value = "yes"');
    expect(calendar).toContain('formData.get("confirmed") !== "yes"');
    expect(calendar).not.toContain("const now = Date.now()");
    expect(engine).toContain("snapshotAtEpoch: now.getTime()");
    expect(engine).toContain("clock_timestamp() < ${slot.startsAt}::timestamptz");
  });

  it("applies Maria's manual calendar to individual starts at every booking safety boundary", () => {
    const availability = read("src/lib/maria-booking-availability.ts");
    const starts = read("src/lib/maria-booking-slots.ts");
    expect(availability).toContain("from maria_manual_closed_starts");
    expect(availability).toContain("manuallyClosedStartsAt:");
    expect(starts).toContain("manuallyClosedStarts.has(start)");
    for(const path of [
      "src/lib/public-booking-verification.ts",
      "src/lib/maria-verified-booking.ts",
      "src/lib/maria-resend-hold.ts",
      "src/lib/maria-customer-reschedule.ts",
      "src/lib/maria-dashboard-reschedule.ts",
    ]) {
      const code=read(path);
      expect(code).toContain("from maria_manual_closed_starts closed");
      expect(code).toContain("closed.workspace_id=");
      expect(code).toContain("closed.starts_at=");
    }
    const calendar = read("src/app/dashboard/maria/kalender/page.tsx");
    expect(calendar).toContain("Inget stängs automatiskt.");
    expect(read("src/lib/maria-manual-calendar.ts")).not.toContain("insert into bookings(");
    expect(read("db/preview-migrations/20261103_0072_maria_manual_closed_starts.sql"))
      .toContain("maria_manual_closed_starts_pk PRIMARY KEY (workspace_id, starts_at)");
    expect(calendar).toContain("Befintliga bokningar och pågående verifieringar");
  });

  it("retains existing booking lengths after Maria changes a service duration", () => {
    const availability = read("src/lib/maria-booking-availability.ts");
    const manager = read("src/lib/maria-dashboard-reschedule.ts");
    const customer = read("src/lib/maria-customer-reschedule.ts");
    expect(availability).toContain("!input.excludeBookingId || !Number.isInteger(input.durationOverrideMinutes)");
    expect(availability).toContain("durationMinutes: input.durationOverrideMinutes ?? Number(service.duration_minutes)");
    expect(manager).toContain("durationOverrideMinutes: durationMinutes");
    expect(manager).toContain("(b.ends_at-b.starts_at)");
    expect(customer).toContain("durationMinutes: originalDurationMinutes");
    expect(customer).toContain("durationOverrideMinutes: originalDurationMinutes");
    expect(customer).toContain("b.starts_at=${bookedStart}::timestamptz");
    expect(customer).toContain("b.ends_at=${bookedEnd}::timestamptz");
    expect(customer).toContain("(b.ends_at-b.starts_at)");
  });

  it("serializes Maria status and rescheduling writes without affecting other tenants", () => {
    const status = read("src/lib/dashboard-booking-status.ts");
    const reschedule = read("src/lib/maria-dashboard-reschedule.ts");
    expect(status).toContain('access.workspaceSlug === "makeup-by-maria"');
    expect(status).toContain('isMariaPreviewTestRecipient(mariaRecipient)');
    expect(status).toContain("lower(trim(c.email))=${mariaRecipient}");
    expect(status).toContain("const updateQuery = sql`");
    expect(status).toContain("pg_advisory_xact_lock(hashtextextended(");
    expect(status).toContain("const rows = mariaPreview");
    expect(reschedule).toContain("pg_advisory_xact_lock(hashtextextended(");
  });

  it("keeps generic calendar moves blocked with a specific bilingual Maria message", () => {
    const writer = read("src/lib/dashboard-calendar-move.ts");
    const ui = read("src/components/dashboard/business-calendar.tsx");
    const page = read("src/app/dashboard/kalender/page.tsx");
    expect(writer).toContain('new CalendarMoveValidationError("maria_preview")');
    expect(ui).toContain('code === "maria_preview"');
    expect(ui).toContain("Öppna bokningen och välj en ny tid.");
    expect(ui).toContain("open its booking details and choose a new time.");
    expect(page).toContain("isEnglish={isEnglish}");
  });

  it("keeps writes scoped, logged and publication state intact", () => {
    const action = read("src/app/dashboard/maria/actions.ts");
    expect(action).toContain('access.workspaceSlug !== "makeup-by-maria"');
    expect(action).toContain("description=excluded.description");
    expect(action).toContain("short_description=excluded.short_description");
    expect(action).toContain("public_status=workspace_services.public_status");
    // Lock must precede both service inserts, not just the post-write assertion.
    expect(action.indexOf("pg_advisory_xact_lock(")).toBeGreaterThan(-1);
    expect(action.indexOf("pg_advisory_xact_lock(")).toBeLessThan(action.indexOf('record("trial"'));
    expect(action).toContain("result[1]?.length !== 1 || result[2]?.length !== 1");
    expect(read("src/app/dashboard/maria/schedule-actions.ts")).toContain(
      "pg_advisory_xact_lock(hashtextextended(",
    );
  });
});
