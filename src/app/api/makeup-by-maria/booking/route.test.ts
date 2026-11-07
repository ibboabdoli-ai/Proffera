import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));
vi.mock("@/lib/maria-booking-runtime", () => ({
  getMariaBookingReadiness: vi.fn(),
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
import { getMariaAvailability } from "@/lib/maria-booking-availability";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";
import { beginBookingEmailVerification } from "@/lib/public-booking-verification";
import { POST } from "./route";

function request(email: string) {
  // Always choose a future Friday inside the supported bridal-year range.
  const friday = new Date(Date.now() + 8 * 86_400_000);
  while (friday.getUTCDay() !== 5) friday.setUTCDate(friday.getUTCDate() + 1);
  const date = friday.toISOString().slice(0, 10);
  const url = "https://maria-qa.vercel.app/api/makeup-by-maria/booking";
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://maria-qa.vercel.app",
    },
    body: JSON.stringify({
      year: Number(date.slice(0, 4)),
      kind: "trial",
      name: "Synthetic QA Bride",
      email,
      phone: "0701234567",
      city: "Södertälje",
      date,
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
  vi.mocked(getMariaBookingReadiness).mockResolvedValue({
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
  it("keeps the verification link when initial email delivery is uncertain", async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce([{ id: "00000000-0000-4000-8000-000000000010", name: "Brudsmink med prov",
        duration_minutes: 180, buffer_before_minutes: 0, buffer_after_minutes: 0,
        minimum_notice_minutes: 0, maximum_advance_days: 365 }])
      .mockResolvedValueOnce([{ opens_at: "06:00", closes_at: "10:00", is_closed: false }]);
    vi.mocked(getSql).mockReturnValue(sql as unknown as ReturnType<typeof getSql>);
    vi.mocked(getMariaAvailability).mockResolvedValue({ ok: true, slots: ["07:00"] });
    vi.mocked(allowPublicSubmission).mockResolvedValue(true);
    const verificationId = "00000000-0000-4000-8000-000000000099";
    vi.mocked(beginBookingEmailVerification).mockResolvedValue({
      ok: false, error: "email", verificationId, delivery: "uncertain",
    });

    const response = await POST(request("qa@example.invalid"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true, delivery: "uncertain",
      verificationUrl: `/boka/verifiera/${verificationId}?lang=sv&channel=uncertain`,
    });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(beginBookingEmailVerification).toHaveBeenCalledTimes(1);
  });

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
