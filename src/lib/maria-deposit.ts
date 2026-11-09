/**
 * Maria Swish deposit: booking-specific QR with recipient, amount
 * and booking-unique reference. Does not initiate or verify payment.
 */
export const MARIA_SWISH_NUMBER = "123-581 86 53";
export const MARIA_SWISH_LINK = "https://app.swish.nu/1/p/sw/?sw=1235818653&src=qr";
export const MARIA_SWISH_QR_PATH = "/demo/makeup-by-maria/assets/maria-swish-qr.jpg";
export const MARIA_DEPOSIT_AMOUNT_SEK = 2_000;
export const MARIA_DEPOSIT_DEADLINE_HOURS = 24;

const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

/** New reservations have an immutable DB-assigned short number. Legacy
 * reservations keep the old full UUID-derived message for payment safety.
 */
export function mariaBookingNumber(bookingId: string, storedReference?: string) {
  if (!uuidPattern.test(bookingId)) throw new Error("INVALID_MARIA_BOOKING_ID");
  if (storedReference !== undefined) {
    if (!/^MBM-[0-9]{10,17}$/.test(storedReference)) {
      throw new Error("INVALID_MARIA_BOOKING_REFERENCE");
    }
    return storedReference;
  }
  return `MBM-${bookingId.replaceAll("-", "").toUpperCase()}`;
}

/** Swish C2B format: receiver, amount in SEK, reference and locked fields. */
export function mariaSwishQrPayload(bookingId: string, reference?: string) {
  const payee = MARIA_SWISH_NUMBER.replace(/\D/g, "");
  const amount = MARIA_DEPOSIT_AMOUNT_SEK.toFixed(2).replace(".", ",");
  return `C${payee};${amount};${encodeURIComponent(mariaBookingNumber(bookingId, reference))};0`;
}

/** First-party payment instructions keep email tracking redirects away from Swish app links. */
export function mariaSwishPaymentPagePath(bookingId: string) {
  mariaBookingNumber(bookingId);
  return `/maria/swish/${bookingId.toLowerCase()}`;
}

/** Return the booking-specific QR endpoint after validating the booking UUID. */
export function mariaSwishQrPath(bookingId: string) {
  mariaBookingNumber(bookingId);
  return `/api/makeup-by-maria/swish-qr/${bookingId.toLowerCase()}`;
}

/** Swish app link with the same payee, SEK amount and booking reference. */
export function mariaSwishPaymentLink(bookingId: string, reference?: string) {
  const url = new URL("https://app.swish.nu/1/p/sw/");
  url.searchParams.set("sw", MARIA_SWISH_NUMBER.replace(/\D/g, ""));
  url.searchParams.set("amt", String(MARIA_DEPOSIT_AMOUNT_SEK));
  url.searchParams.set("cur", "SEK");
  url.searchParams.set("msg", mariaBookingNumber(bookingId, reference));
  url.searchParams.set("src", "qr");
  return url.toString();
}

/** Return the fixed deposit deadline after confirmation; reject invalid dates. */
export function mariaDepositDeadline(confirmedAt: Date) {
  const time = confirmedAt.getTime();
  if (!Number.isFinite(time)) throw new Error("INVALID_MARIA_CONFIRMATION_TIME");
  return new Date(time + MARIA_DEPOSIT_DEADLINE_HOURS * 60 * 60 * 1_000);
}
