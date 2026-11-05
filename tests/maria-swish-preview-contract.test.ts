import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const file = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const assetPath = "public/demo/makeup-by-maria/assets/maria-swish-qr.jpg";

describe("Makeup by Maria Preview deposit flow contract", () => {
  it("ships a static customer-supplied QR asset without an external image host", () => {
    const image = readFileSync(resolve(process.cwd(), assetPath));
    expect(statSync(resolve(process.cwd(), assetPath)).size).toBeGreaterThan(100_000);
    expect(image[0]).toBe(0xff);
    expect(image[1]).toBe(0xd8);
    expect(image[2]).toBe(0xff);
  });

  it("keeps Maria email separate from normal tenant status notifications", () => {
    const action = file("src/app/dashboard/bokningar/[id]/page.tsx");
    expect(action).toContain('workspaceAccess.workspaceSlug === "makeup-by-maria"');
    expect(action).toContain('if (!getMariaPreviewPortalBase() || !current?.customer');
    expect(action).toContain('isMariaPreviewTestRecipient(current.customer.email)');
    expect(action).toContain("await sendMariaBookingStatusEmail({");
    expect(action).toContain("result.changed && result.notification");
    expect(action).toContain("} else {\n        await Promise.allSettled([");
    expect(action).toContain("sendBookingCustomerSms({");
    expect(action).toContain("maria_mail=failed");
    expect(action).toContain("Maria Preview reschedules never send an SMS to a real phone");
    expect(action).toContain("if (isMariaPreviewTestRecipient(notification.customerEmail))");
  });

  it("shows one shared Swish booking number and a manual paid control in Maria Preview", () => {
    const list = file("src/app/dashboard/bokningar/page.tsx");
    const detail = file("src/app/dashboard/bokningar/[id]/page.tsx");
    const control = file("src/components/dashboard/maria-swish-payment-control.tsx");
    expect(list).toContain('access.workspaceSlug === "makeup-by-maria"');
    expect(list).toContain('canManageWorkspaceSettings(access)');
    expect(list).toContain('process.env.VERCEL_ENV === "preview"');
    expect(list).toContain('readMariaManualSwishStatuses()');
    expect(list).toContain("mariaPreview && manualSwish?.entries[booking.id]");
    expect(list).toContain("<MariaSwishPaymentControl");
    expect(detail).toContain("<MariaSwishPaymentControl");
    expect(detail).toContain("mariaPreview && manualSwish?.entries[booking.id]");
    expect(control).toContain("mariaBookingNumber(bookingId)");
    expect(control).toContain('name="swish_checked" required');
    expect(control).toContain("Jag har kontrollerat betalningen i Swish.");
    expect(control).toContain("Markera som betald");
    expect(control).toContain("Ångra betalningsmarkering");
    expect(control).toContain("Betalningsstatus kunde inte läsas.");
  });

  it("persists manual Swish marks in scoped, append-only events, without a payment gateway", () => {
    const db = file("src/lib/maria-manual-swish.ts");
    const action = file("src/app/dashboard/maria/payment-actions.ts");
    expect(db).toContain('process.env.VERCEL_ENV !== "preview"');
    expect(db).toContain('access.workspaceSlug !== "makeup-by-maria"');
    expect(db).toContain('canManageWorkspaceSettings(access)');
    expect(db).toContain('hasDashboardModuleAccess("online_booking")');
    expect(db).toContain('const source = "maria_swish_manual_deposit_v1"');
    expect(db).toContain("left join lateral (");
    expect(db).toContain("b.customer_id is not null");
    expect(db).toContain("b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')");
    expect(db).toContain("join workspaces w on w.id::text = b.workspace_id");
    expect(db).toContain("pg_advisory_xact_lock");
    expect(db).toContain("insert into customer_events");
    expect(db).toContain("where coalesce((select state from latest), 'unverified') <> ${state}");
    expect(db).toContain("'actor_user_id', ${access.userId}");
    expect(db).toContain("b.status in ('confirmed', 'completed')");
    expect(db).not.toContain("workspace_service_job_payments");
    expect(db).not.toContain("fetch(");
    expect(action).toContain('data.get("swish_checked") !== "on"');
    expect(action).toContain('revalidatePath("/dashboard/bokningar")');
  });

  it("does not add a payment gateway, automatic cancellation or production flag", () => {
    const policy = file("src/lib/maria-deposit.ts");
    const email = file("src/features/email/maria-deposit-email.ts");
    expect(policy).toContain("MARIA_DEPOSIT_DEADLINE_HOURS = 24");
    expect(policy).toContain("MARIA_DEPOSIT_AMOUNT_SEK = 2_000");
    expect(email).toContain("getMariaPreviewPortalBase()");
    expect(email).toContain("isMariaPreviewTestRecipient(input.customerEmail)");
    expect(email).toContain("Avbokning sker inte automatiskt");
    expect(policy).toContain('MARIA_SWISH_QR_PATH = "/demo/makeup-by-maria/assets/maria-swish-qr.jpg"');
    expect(email).toContain("new URL(mariaSwishQrPath(input.bookingId), origin)");
    expect(email).not.toContain("STRIPE_SECRET_KEY");
  });
});
