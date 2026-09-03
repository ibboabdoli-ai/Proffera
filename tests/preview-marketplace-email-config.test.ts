import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { marketplaceGuestInvitationEmailConfigured } from "@/features/email/marketplace-guest-invitation-email";

const originalEnv = { ...process.env };
const guestQuoteSource = readFileSync(
  path.join(process.cwd(), "src/lib/marketplace-guest-quote.ts"),
  "utf8",
);

function setCommonEmailEnv() {
  vi.stubEnv("LEAD_FROM_EMAIL", "Proffera <lead@proffera.se>");
  vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "preview-sink@example.com");
}

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
});

describe("Marketplace Preview email configuration", () => {
  it("accepts a dedicated Preview Brevo key without requiring the shared key", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "preview-only-key");
    vi.stubEnv("BREVO_API_KEY", "");
    setCommonEmailEnv();

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(true);
  });

  it("fails closed when Preview is missing its dedicated Brevo key", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "");
    vi.stubEnv("BREVO_API_KEY", "production-key");
    setCommonEmailEnv();

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(false);
  });

  it("fails closed when the Preview key overlaps the shared Production key", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "shared-key");
    vi.stubEnv("BREVO_API_KEY", "shared-key");
    setCommonEmailEnv();

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(false);
  });

  it("preserves Production readiness when the shared Brevo key is configured", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BREVO_API_KEY", "production-key");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "");
    vi.stubEnv("LEAD_FROM_EMAIL", "Proffera <lead@proffera.se>");

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(true);
  });

  it("fails closed in Production when the shared Brevo key is missing", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "preview-only-key");
    vi.stubEnv("LEAD_FROM_EMAIL", "Proffera <lead@proffera.se>");

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(false);
  });

  it("keeps LEAD_FROM_EMAIL mandatory", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "preview-only-key");
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("LEAD_FROM_EMAIL", "");
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "preview-sink@example.com");

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(false);
  });

  it("uses the canonical Preview-aware readiness helper at the guest-dispatch boundary", () => {
    expect(guestQuoteSource).toContain("marketplaceGuestInvitationEmailConfigured()");
    expect(guestQuoteSource).not.toContain("if (!process.env.BREVO_API_KEY || !process.env.LEAD_FROM_EMAIL)");
  });
});
