import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const assetPath = "public/demo/makeup-by-maria/assets/maria-client-logo.jpg";
const logoUrl = "/demo/makeup-by-maria/assets/maria-client-logo.jpg";
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Makeup by Maria client-approved logo in Preview", () => {
  it("ships the customer image as a self-hosted JPEG asset", () => {
    const image = readFileSync(resolve(root, assetPath));
    expect(statSync(resolve(root, assetPath)).size).toBeGreaterThan(50_000);
    expect(image[0]).toBe(0xff);
    expect(image[1]).toBe(0xd8);
    expect(image[2]).toBe(0xff);
  });

  it("uses the same image on the primary booking and secondary portfolio pages", () => {
    const booking = read("public/demo/makeup-by-maria-v2.html");
    const portfolio = read("public/demo/makeup-by-maria.html");
    expect(booking.match(new RegExp(logoUrl.replace(/[.*+?^$()|[\]{}]/g, "\\$&"), "g"))?.length).toBeGreaterThanOrEqual(4);
    expect(portfolio.match(new RegExp(logoUrl.replace(/[.*+?^$()|[\]{}]/g, "\\$&"), "g"))?.length).toBeGreaterThanOrEqual(4);
    expect(booking).toContain('alt="Makeup by Maria — Bridal & Event Makeup"');
    expect(portfolio).toContain('alt="Makeup by Maria — Bridal & Event Makeup"');
    expect(booking).not.toContain('maria-wordmark.svg');
    expect(booking).not.toContain('maria-stacked.svg');
  });

  it("keeps emails on the self-hosted Maria image rather than another tenant's logo", () => {
    const verification = read("src/features/email/booking-verification-email.ts");
    const confirmation = read("src/features/email/unified-booking-confirmation-email.ts");
    expect(verification).toContain(logoUrl);
    expect(confirmation).toContain(logoUrl);
    expect(verification).toContain('input.branding === "makeup-by-maria"');
    expect(confirmation).toContain('input.branding === "makeup-by-maria"');
  });
});
