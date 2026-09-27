/** Preserve the owner's raw input while converting accepted kronor amounts to öre. */
export function parseRestaurantPrice(raw: string): number | null | undefined {
  if (raw === "") return null;
  if (!/^\d+(?:[.,]\d{0,2})?$/.test(raw)) return undefined;
  const ore = Math.round(Number(raw.replace(",", ".")) * 100);
  return Number.isSafeInteger(ore) && ore <= 10_000_000 ? ore : undefined;
}
