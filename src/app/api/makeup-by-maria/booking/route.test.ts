import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));
vi.mock("@/lib/maria-preview-booking", () => ({
  getMariaPreviewBookingReadiness: vi.fn(),
}));
vi.mock("@/lib/maria-booking-availability", () => ({
  getMariaAvailability: vi.fn(),
}));
vi.mock("@/lib/public-form-protection", () => ({
  allowPublicSubmission: vi.fn(),
}));
vi.mock("@/lib/public-booking-verification", () => ({
  beginBookingEmailVerification: vi.fn(),
}));

import { getSql } from "@/lib/db/server";
import { getMariaPreviewBookingReadiness } from "@/lib/maria-preview-booking";
import { beginBookingEmailVerification } from "@/lib/public-booking-verification";
import { POST } from "./route";

function request(email: string) {
  const url = "https://maria-qa.vercel.app/api/makeup-by-maria/booking";
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://maria-qa.vercel.app",
    },
    body: JSON.stringify({
      year: 2026,
      kind: "trial",
      name: "Synthetic QA Bride",
      email,
      phone: "0701234567",
      city: "Södertälje",
      date: "2026-11-20",
      time: "07:00",
      startedAt: Date.now() - 5000,
      lang: "sv",
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "qa@example.invalid");
  vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "qa@example.invalid");
  vi.mocked(getMariaPreviewBookingReadiness).mockResolvedValue({
    enabled: true,
    workspaceId: "11111111-2222-4333-8444-555555555555",
    publicSlug: "makeup-by-maria",
    companyName: "Makeup by Maria",
    ownerEmail: "qa@example.invalid",
    ownerPhone: "",
    primaryCity: "Södertälje",
    timeZone: "Europe/Stockholm",
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("Maria isolated Preview booking email egress safety", () => {
  it("refuses a mismatched effective Preview inbox before DB/OTP hold creation", async () => {
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "other@example.invalid");
    const result = await POST(request("qa@example.invalid"));
    expect(result.status).toBe(403);
    expect(await result.json()).toEqual({ ok: false, error: "unavailable" });
    expect(getSql).not.toHaveBeenCalled();
    expect(beginBookingEmailVerification).not.toHaveBeenCalled();
  });

  it("refuses a missing or invalid effective Preview inbox without writing", async () => {
    for (const recipient of ["", "invalid-recipient"]) {
      vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", recipient);
      const result = await POST(request("qa@example.invalid"));
      expect(result.status).toBe(403);
      expect(getSql).not.toHaveBeenCalled();
      expect(beginBookingEmailVerification).not.toHaveBeenCalled();
    }
  });

  it("refuses a non-allowlisted customer and any Production invocation", async () => {
    expect((await POST(request("bride@example.com"))).status).toBe(403);
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await POST(request("qa@example.invalid"))).status).toBe(403);
    expect(getSql).not.toHaveBeenCalled();
    expect(beginBookingEmailVerification).not.toHaveBeenCalled();
  });
});
