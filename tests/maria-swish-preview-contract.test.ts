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

  it("does not add a payment gateway, automatic cancellation, migration or production flag", () => {
    const policy = file("src/lib/maria-deposit.ts");
    const email = file("src/features/email/maria-deposit-email.ts");
    expect(policy).toContain("MARIA_DEPOSIT_DEADLINE_HOURS = 24");
    expect(policy).toContain("MARIA_DEPOSIT_AMOUNT_SEK = 2_000");
    expect(email).toContain("getMariaPreviewPortalBase()");
    expect(email).toContain("isMariaPreviewTestRecipient(input.customerEmail)");
    expect(email).toContain("Avbokning sker inte automatiskt");
    expect(policy).toContain('MARIA_SWISH_QR_PATH = "/demo/makeup-by-maria/assets/maria-swish-qr.jpg"');
    expect(email).toContain("new URL(MARIA_SWISH_QR_PATH, origin)");
    expect(email).not.toContain("STRIPE_SECRET_KEY");
  });
});
