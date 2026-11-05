import { describe, expect, it } from "vitest";
import {
  MARIA_DEPOSIT_AMOUNT_SEK, MARIA_SWISH_LINK, MARIA_SWISH_NUMBER,
  MARIA_SWISH_QR_PATH, mariaBookingNumber, mariaDepositDeadline,
} from "./maria-deposit";

describe("Maria Swish booking reference and deposit policy", () => {
  it("keeps the user's QR recipient and the agreed deposit amount", () => {
    expect(MARIA_SWISH_NUMBER).toBe("123-581 86 53");
    expect(new URL(MARIA_SWISH_LINK).searchParams.get("sw")).toBe("1235818653");
    expect(new URL(MARIA_SWISH_LINK).searchParams.get("src")).toBe("qr");
    expect(new URL(MARIA_SWISH_LINK).searchParams.has("amt")).toBe(false);
    expect(MARIA_SWISH_QR_PATH).toBe("/demo/makeup-by-maria/assets/maria-swish-qr.jpg");
    expect(MARIA_DEPOSIT_AMOUNT_SEK).toBe(2000);
  });
  it("uses a full collision-free UUID-derived reference for every booking", () => {
    const first = mariaBookingNumber("00000000-0000-0000-0000-000000000001");
    const second = mariaBookingNumber("00000000-0000-0000-0000-000000000002");
    expect(first).toBe("MBM-00000000000000000000000000000001");
    expect(second).not.toBe(first);
    expect(() => mariaBookingNumber("short")).toThrow("INVALID_MARIA_BOOKING_ID");
  });
  it("sets 24 hours from manual confirmation and rejects bad dates", () => {
    const confirmed = new Date("2026-11-02T15:00:00.000Z");
    expect(mariaDepositDeadline(confirmed).toISOString()).toBe("2026-11-03T15:00:00.000Z");
    expect(() => mariaDepositDeadline(new Date("invalid"))).toThrow("INVALID_MARIA_CONFIRMATION_TIME");
  });
});
