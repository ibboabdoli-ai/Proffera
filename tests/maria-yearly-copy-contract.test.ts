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
