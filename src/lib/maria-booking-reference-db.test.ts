import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: vi.fn() }));

import { getSql } from "@/lib/db/server";
import { readMariaBookingReference } from "./maria-booking-reference-db";

const bookingId = "c0eb47ac-cecf-4bd4-98c3-1b8b6deeb2ff";

afterEach(() => vi.clearAllMocks());

describe("Maria persisted booking payment reference", () => {
  it("uses the immutable short number for a newly finalized booking", async () => {
    const query = vi.fn().mockResolvedValue([{ reference: "MBM-2026111001" }]);
    vi.mocked(getSql).mockReturnValue(query as never);
    expect(await readMariaBookingReference(bookingId)).toBe("MBM-2026111001");
    expect(query).toHaveBeenCalledOnce();
    const sqlText = (query.mock.calls[0]![0] as TemplateStringsArray).join("?");
    expect(sqlText).toContain("left join maria_booking_references");
    expect(sqlText).toContain("w.slug='makeup-by-maria'");
  });

  it("keeps legacy bookings on the original UUID reference", async () => {
    vi.mocked(getSql).mockReturnValue(
      vi.fn().mockResolvedValue([{ reference: null }]) as never,
    );
    expect(await readMariaBookingReference(bookingId))
      .toBe("MBM-C0EB47ACCECF4BD498C31B8B6DEEB2FF");
  });

  it("rejects missing, unsafe and tampered booking references", async () => {
    const query = vi.fn().mockResolvedValueOnce([]);
    vi.mocked(getSql).mockReturnValue(query as never);
    await expect(readMariaBookingReference(bookingId))
      .rejects.toThrow("MARIA_REFERENCE_BOOKING_NOT_FOUND");
    query.mockResolvedValueOnce([{ reference: "MBM-evil" }]);
    await expect(readMariaBookingReference(bookingId))
      .rejects.toThrow("INVALID_MARIA_BOOKING_REFERENCE");
    await expect(readMariaBookingReference("bad-uuid"))
      .rejects.toThrow("INVALID_MARIA_BOOKING_ID");
    expect(query).toHaveBeenCalledTimes(2);
  });
});
