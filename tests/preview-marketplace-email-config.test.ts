import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { marketplaceGuestInvitationEmailConfigured } from "@/features/email/marketplace-guest-invitation-email";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
});

describe("Marketplace Preview email configuration", () => {
  it("accepts a dedicated Preview Brevo key without requiring the shared key", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "preview-only-key");
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "preview-sink@example.com");
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("LEAD_FROM_EMAIL", "Proffera <lead@proffera.se>");

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(true);
  });

  it("fails closed when the Preview key overlaps the shared key", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "shared-key");
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "preview-sink@example.com");
    vi.stubEnv("BREVO_API_KEY", "shared-key");
    vi.stubEnv("LEAD_FROM_EMAIL", "Proffera <lead@proffera.se>");

    expect(marketplaceGuestInvitationEmailConfigured()).toBe(false);
  });
});
