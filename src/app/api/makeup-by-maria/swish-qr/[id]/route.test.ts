import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));
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
    const sql = vi.fn().mockResolvedValueOnce([{ id }]).mockResolvedValueOnce([{ count: 0 }]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    const response = await GET(request, params);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect([...new Uint8Array(await response.arrayBuffer()).slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(sql).toHaveBeenCalledTimes(2);
  });

  it("fails closed in Production, for malformed IDs, or with a disabled Preview switch", async () => {
    const sql = vi.fn();
    vi.mocked(getSql).mockReturnValue(sql as never);
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await GET(request, params)).status).toBe(404);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await GET(request, { params: Promise.resolve({ id: "not-a-uuid" }) })).status).toBe(404);
    vi.stubEnv("PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED", "false");
    expect((await GET(request, params)).status).toBe(404);
    expect(sql).not.toHaveBeenCalled();
  });

  it("rejects absent bookings, ambiguous short references and unauthorized recipients", async () => {
    let sql = vi.fn().mockResolvedValueOnce([]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    expect((await GET(request, params)).status).toBe(404);

    sql = vi.fn().mockResolvedValueOnce([{ id }]).mockResolvedValueOnce([{ count: 1 }]);
    vi.mocked(getSql).mockReturnValue(sql as never);
    expect((await GET(request, params)).status).toBe(409);

    vi.stubEnv("PROFFERA_MARIA_PREVIEW_TEST_EMAIL", "other@example.invalid");
    expect((await GET(request, params)).status).toBe(404);
  });
});
