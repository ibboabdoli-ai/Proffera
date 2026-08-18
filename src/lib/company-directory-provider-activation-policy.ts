export const providerMarketplaceConversionModes = ["book", "quote", "book_or_quote", "contact"] as const;

export type ProviderMarketplaceConversionMode = (typeof providerMarketplaceConversionModes)[number];

export function normalizeSwedishOrganizationNumber(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return /^\d{10}$/.test(digits) ? digits : null;
}

export function isProviderMarketplaceConversionMode(value: unknown): value is ProviderMarketplaceConversionMode {
  return providerMarketplaceConversionModes.includes(value as ProviderMarketplaceConversionMode);
}

export function normalizeProviderServiceAreaRadius(value: unknown) {
  const radius = Number(value);
  if (!Number.isFinite(radius)) return null;
  const rounded = Math.round(radius * 10) / 10;
  return rounded >= 1 && rounded <= 300 ? rounded : null;
}
