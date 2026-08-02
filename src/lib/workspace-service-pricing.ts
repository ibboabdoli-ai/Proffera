import type { WorkspaceBillingCurrency } from "./workspace-market";

export const workspaceServicePriceTypes = ["fixed", "from", "quote"] as const;

export type WorkspaceServicePriceType = (typeof workspaceServicePriceTypes)[number];

export type WorkspaceServicePriceDraft = {
  priceType: unknown;
  amount: unknown;
  currency: WorkspaceBillingCurrency;
};

export type NormalizedWorkspaceServicePrice = {
  priceType: WorkspaceServicePriceType;
  amountMinor: number | null;
  currency: WorkspaceBillingCurrency;
};

export type WorkspaceServicePriceValidationResult =
  | { ok: true; value: NormalizedWorkspaceServicePrice }
  | { ok: false; error: "price_type" | "price_amount" };

export function isWorkspaceServicePriceType(value: unknown): value is WorkspaceServicePriceType {
  return typeof value === "string" && workspaceServicePriceTypes.includes(value as WorkspaceServicePriceType);
}

function parseAmountMinor(value: unknown) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));

  return Number.isSafeInteger(amountMinor) && amountMinor >= 0 && amountMinor <= 999_999_999_00
    ? amountMinor
    : null;
}

export function validateWorkspaceServicePrice(
  draft: WorkspaceServicePriceDraft,
): WorkspaceServicePriceValidationResult {
  if (!isWorkspaceServicePriceType(draft.priceType)) {
    return { ok: false, error: "price_type" };
  }

  if (draft.priceType === "quote") {
    if (String(draft.amount ?? "").trim()) return { ok: false, error: "price_amount" };
    return {
      ok: true,
      value: { priceType: "quote", amountMinor: null, currency: draft.currency },
    };
  }

  const amountMinor = parseAmountMinor(draft.amount);
  if (amountMinor === null) return { ok: false, error: "price_amount" };

  return {
    ok: true,
    value: { priceType: draft.priceType, amountMinor, currency: draft.currency },
  };
}

export function formatWorkspaceServicePrice(
  price: NormalizedWorkspaceServicePrice,
  locale: "sv" | "en",
) {
  if (price.priceType === "quote") return locale === "en" ? "Request a quote" : "Begär offert";

  const formatted = new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: price.amountMinor! % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price.amountMinor! / 100);

  return price.priceType === "from"
    ? locale === "en" ? `From ${formatted}` : `Från ${formatted}`
    : formatted;
}
