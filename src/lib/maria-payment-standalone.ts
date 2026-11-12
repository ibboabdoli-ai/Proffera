/** Maria Swish payment page shell, isolated to the exact Preview route or Maria Production host.
 * Shared by request routing and client-side transitions.
 */
export const MARIA_PAYMENT_SHELL_HEADER = "x-proffera-maria-standalone-payment-shell";

const bookingUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Match only a single booking-specific Swish route, never descendant paths. */
export function isMariaPaymentStandalonePath(pathname: string | null | undefined): boolean {
  if (!pathname || !pathname.startsWith("/maria/swish/")) return false;
  return bookingUuid.test(pathname.slice("/maria/swish/".length));
}
