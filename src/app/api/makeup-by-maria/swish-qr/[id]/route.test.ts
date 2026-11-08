import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));
vi.mock("@/lib/maria-booking-runtime", () => ({
  // Exercise the QR eligibility SQL directly with synthetic, scoped bookings.
  // Existing confirmed unpaid Production bookings can pay when intake is paused.
  getMariaBookingReadiness: async () =>
    process.env.VERCEL_ENV === "preview" &&
    process.env.PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED === "true"
      ? { enabled: true, workspaceId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }
      : { enabled: false },
}));
vi.mock("@/lib/maria-preview-customer-safety", () => ({
  isMariaPreviewTestRecipient: (email: string) => email === "qa@example.invalid",
}));

import { getSql } from "@/lib/db/server";
import { GET } from "./route";

const id = "c0eb47ac-cecf-4bd4-98c3-1b8b6deeb2ff";
const request = new Request(`https://maria-qa.vercel.app/api/makeup-by-maria/swish-qr/${id}`);
const params = { params: Promise.resolve({ id }) };

beforeEach(() => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED", "true");
  vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "qa@example.invalid");
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Maria Preview booking-specific Swish QR", () => {
  it("generates a real PNG only for a confirmed QA booking with an unambiguous reference", async () => {
    const sql = vi.fn().mockResolvedValueOnce([{ id }]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect([...new Uint8Array(await response.arrayBuffer()).slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(sql).toHaveBeenCalledOnce();
  });

  it("keeps tenant, booking-state, source, and QA-email constraints in the actual eligibility query", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    expect((await GET(request, params)).status).toBe(404);
    expect(sql).toHaveBeenCalledTimes(1);
    const call = sql.mock.calls[0]!;
    const parts = call[0] as unknown as TemplateStringsArray;
    const bound = call.slice(1);
    const text = Array.from(parts)
      .map((part, index) => part + (index < bound.length ? "$" + (index + 1) : ""))
      .join("");
    expect(text).toContain("join workspaces w on w.id::text=b.workspace_id");
    expect(text).toContain("join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id");
    expect(text).toContain("where w.slug='makeup-by-maria'");
    expect(text).toContain("w.status in ('active','trial')");
    expect(text).toContain("b.id=$1::uuid");
    expect(text).toContain("b.status in ('confirmed','completed')");
    expect(text).toContain("b.source='public_booking'");
    expect(text).toContain("lower(trim(c.email))=$3");
    expect(text).toContain("b.workspace_id=$5");
    expect(text).toContain("maria_swish_manual_deposit_v1");
    expect(text).toContain("<> 'paid'");
    expect(bound).toEqual([id, false, "qa@example.invalid", false, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"]);
  });

  it("supports a Production PNG for an existing confirmed unpaid booking with a unique reference", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const sql = vi.fn().mockResolvedValueOnce([{ id }]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect([...new Uint8Array(await response.arrayBuffer()).slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(sql).toHaveBeenCalledOnce();
  });

  it("refuses missing or paid Production bookings, malformed IDs, and disabled Preview intake", async () => {
    const sql = vi.fn().mockResolvedValue([]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await GET(request, params)).status).toBe(404);
    expect(sql).toHaveBeenCalledOnce();
    sql.mockClear();
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await GET(request, { params: Promise.resolve({ id: "not-a-uuid" }) })).status).toBe(404);
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED", "false");
    expect((await GET(request, params)).status).toBe(404);
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED", "true");
    // Regression: a missing fourth UUID segment is not a valid booking ID.
    const truncatedId = "c0eb47ac-cecf-4bd4-98c31b8b6deeb2ff";
    expect((await GET(request, { params: Promise.resolve({ id: truncatedId }) })).status).toBe(404);
    expect(sql).not.toHaveBeenCalled();
  });

  it("rejects absent bookings and unauthorized recipients without a duplicate-prefix lookup", async () => {
    const sql = vi.fn().mockResolvedValueOnce([]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    expect((await GET(request, params)).status).toBe(404);
    expect(sql).toHaveBeenCalledOnce();
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "other@example.invalid");
    expect((await GET(request, params)).status).toBe(404);
    expect(sql).toHaveBeenCalledOnce();
  });
});
