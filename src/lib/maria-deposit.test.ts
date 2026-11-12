import { describe, expect, it } from "vitest";
import {
  MARIA_DEPOSIT_AMOUNT_SEK, MARIA_SWISH_LINK, MARIA_SWISH_NUMBER,
  MARIA_SWISH_QR_PATH, mariaBookingNumber, mariaDepositDeadline,
  mariaSwishPaymentLink, mariaSwishPaymentPagePath, mariaSwishQrPath, mariaSwishQrPayload,
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
  it("uses the entire immutable booking UUID, preventing collisions of short prefixes", () => {
    const first = mariaBookingNumber("abcdef00-1111-4111-8111-111111111111");
    const second = mariaBookingNumber("abcdef99-2222-4222-8222-222222222222");
    expect(first).toBe("MBM-ABCDEF00111141118111111111111111");
    expect(second).toBe("MBM-ABCDEF99222242228222222222222222");
    expect(first).not.toBe(second);
    expect(first).toMatch(/^MBM-[0-9A-F]{32}$/);
    expect(first.length).toBeLessThanOrEqual(50);
    expect(() => mariaBookingNumber("short")).toThrow("INVALID_MARIA_BOOKING_ID");
  });

  it("prefills the Swish QR and app link with the correct receiver, amount and message", () => {
    const id = "c0eb47ac-cecf-4bd4-98c3-1b8b6deeb2ff";
    expect(mariaSwishQrPayload(id)).toBe("C1235818653;2000,00;MBM-C0EB47ACCECF4BD498C31B8B6DEEB2FF;0");
    expect(mariaSwishQrPath(id)).toBe(`/api/makeup-by-maria/swish-qr/${id}`);
    expect(mariaSwishPaymentPagePath(id)).toBe(`/maria/swish/${id}`);
    const link = new URL(mariaSwishPaymentLink(id));
    expect(link.searchParams.get("sw")).toBe("1235818653");
    expect(link.searchParams.get("amt")).toBe("2000");
    expect(link.searchParams.get("cur")).toBe("SEK");
    expect(link.searchParams.get("msg")).toBe("MBM-C0EB47ACCECF4BD498C31B8B6DEEB2FF");
    expect(link.searchParams.get("src")).toBe("qr");
  });
  it("keeps an assigned short reference identical across Swish payloads", () => {
    const bookingId = "c0eb47ac-cecf-4bd4-98c3-1b8b6deeb2ff";
    const reference = "MBM-2026111001";
    expect(mariaBookingNumber(bookingId, reference)).toBe(reference);
    // Legacy references remain usable only for their original booking ID.
    const original = mariaBookingNumber(bookingId);
    expect(mariaBookingNumber(bookingId, original)).toBe(original);
    expect(() => mariaBookingNumber("11111111-2222-4333-8444-555555555555", original))
      .toThrow("INVALID_MARIA_BOOKING_REFERENCE");
    expect(mariaSwishQrPayload(bookingId, reference)).toBe(
      "C1235818653;2000,00;MBM-2026111001;0"
    );
    expect(new URL(mariaSwishPaymentLink(bookingId, reference)).searchParams.get("msg")).toBe(reference);
    expect(() => mariaBookingNumber(bookingId, "MBM-INVALID")).toThrow("INVALID_MARIA_BOOKING_REFERENCE");
  });

  it("sets 24 hours from manual confirmation and rejects bad dates", () => {
    const confirmed = new Date("2026-11-02T15:00:00.000Z");
    expect(mariaDepositDeadline(confirmed).toISOString()).toBe("2026-11-03T15:00:00.000Z");
    expect(() => mariaDepositDeadline(new Date("invalid"))).toThrow("INVALID_MARIA_CONFIRMATION_TIME");
  });
});
