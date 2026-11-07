/**
 * Makeup by Maria's customer-supplied static Swish business QR.
 * The QR encodes the recipient only; it does NOT encode the price or reference.
 * Payment confirmation and cancellation remain manual.
 */
export const MARIA_SWISH_NUMBER = "123-581 86 53";
export const MARIA_SWISH_LINK = "https://app.swish.nu/1/p/sw/?sw=1235818653&src=qr";
export const MARIA_SWISH_QR_PATH = "/demo/makeup-by-maria/assets/maria-swish-qr.jpg";
export const MARIA_DEPOSIT_AMOUNT_SEK = 2_000;
export const MARIA_DEPOSIT_DEADLINE_HOURS = 24;

const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

export function mariaBookingNumber(bookingId: string) {
  if (!uuidPattern.test(bookingId)) throw new Error("INVALID_MARIA_BOOKING_ID");
  // Full UUID, not a truncated hash: no new risk of a payment reference collision.
  return `MBM-${bookingId.replaceAll("-", "").toUpperCase()}`;
}

export function mariaDepositDeadline(confirmedAt: Date) {
  const time = confirmedAt.getTime();
  if (!Number.isFinite(time)) throw new Error("INVALID_MARIA_CONFIRMATION_TIME");
  return new Date(time + MARIA_DEPOSIT_DEADLINE_HOURS * 60 * 60 * 1_000);
}
