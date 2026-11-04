/**
 * Preview-only Maria Swish deposit: booking-specific QR with recipient, amount
 * and short reference. Does not initiate or verify payment.
 */
export const MARIA_SWISH_NUMBER = "123-581 86 53";
export const MARIA_SWISH_LINK = "https://app.swish.nu/1/p/sw/?sw=1235818653&src=qr";
export const MARIA_SWISH_QR_PATH = "/demo/makeup-by-maria/assets/maria-swish-qr.jpg";
export const MARIA_DEPOSIT_AMOUNT_SEK = 2_000;
export const MARIA_DEPOSIT_DEADLINE_HOURS = 24;

const uuidPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

export function mariaBookingNumber(bookingId: string) {
  if (!uuidPattern.test(bookingId)) throw new Error("INVALID_MARIA_BOOKING_ID");
  // Six readable characters. Preview QR retrieval refuses an ambiguous match.
  return `MBM-${bookingId.slice(0, 6).toUpperCase()}`;
}

/** Swish C2B format: receiver, amount in SEK, reference and locked fields. */
export function mariaSwishQrPayload(bookingId: string) {
  const payee = MARIA_SWISH_NUMBER.replace(/\D/g, "");
  const amount = MARIA_DEPOSIT_AMOUNT_SEK.toFixed(2).replace(".", ",");
  return `C${payee};${amount};${encodeURIComponent(mariaBookingNumber(bookingId))};0`;
}

export function mariaSwishQrPath(bookingId: string) {
  mariaBookingNumber(bookingId);
  return `/api/makeup-by-maria/swish-qr/${bookingId.toLowerCase()}`;
}

/** Swish app link with the same payee, SEK amount and booking reference. */
export function mariaSwishPaymentLink(bookingId: string) {
  const url = new URL("https://app.swish.nu/1/p/sw/");
  url.searchParams.set("sw", MARIA_SWISH_NUMBER.replace(/\D/g, ""));
  url.searchParams.set("amt", String(MARIA_DEPOSIT_AMOUNT_SEK));
  url.searchParams.set("cur", "SEK");
  url.searchParams.set("msg", mariaBookingNumber(bookingId));
  url.searchParams.set("src", "qr");
  return url.toString();
}

export function mariaDepositDeadline(confirmedAt: Date) {
  const time = confirmedAt.getTime();
  if (!Number.isFinite(time)) throw new Error("INVALID_MARIA_CONFIRMATION_TIME");
  return new Date(time + MARIA_DEPOSIT_DEADLINE_HOURS * 60 * 60 * 1_000);
}
