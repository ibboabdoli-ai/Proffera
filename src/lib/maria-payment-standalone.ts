/** Preview-only Maria Swish payment page, not a general public site shell.
 * Shared by request routing and client-side transitions.
 */
export const MARIA_PAYMENT_SHELL_HEADER = "x-proffera-maria-preview-payment-shell";

const bookingUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Match only a single booking-specific Swish route, never descendant paths. */
export function isMariaPaymentStandalonePath(pathname: string | null | undefined): boolean {
  if (!pathname || !pathname.startsWith("/maria/swish/")) return false;
  return bookingUuid.test(pathname.slice("/maria/swish/".length));
}
