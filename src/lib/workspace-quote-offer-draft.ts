import type { WorkspaceBillingCurrency } from "./workspace-market";
import { calculateQuoteOfferTotals } from "./workspace-quote-offer-policy";
import { validateWorkspaceServicePrice } from "./workspace-service-pricing";

export type WorkspaceQuoteOfferDraftInput = {
  amount: unknown;
  vatRate: unknown;
  title: unknown;
  terms: unknown;
  validUntil: unknown;
  currency: WorkspaceBillingCurrency;
};

export type NormalizedWorkspaceQuoteOfferDraft = {
  currency: WorkspaceBillingCurrency;
  subtotalMinor: number;
  vatRateBasisPoints: number;
  vatAmountMinor: number;
  totalMinor: number;
  title: string;
  terms: string;
  validUntil: string | null;
};

export type WorkspaceQuoteOfferDraftResult =
  | { ok: true; value: NormalizedWorkspaceQuoteOfferDraft }
  | { ok: false; error: "amount" | "vat_rate" | "title" | "terms" | "valid_until" };

function parseVatRateBasisPoints(value: unknown) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const basisPoints = Math.round(Number(normalized) * 100);
  return Number.isInteger(basisPoints) && basisPoints >= 0 && basisPoints <= 10_000
    ? basisPoints
    : null;
}

function normalizeDate(value: unknown) {
  const date = String(value ?? "").trim();
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date
    ? undefined
    : date;
}

export function validateWorkspaceQuoteOfferDraft(
  input: WorkspaceQuoteOfferDraftInput,
): WorkspaceQuoteOfferDraftResult {
  const price = validateWorkspaceServicePrice({
    priceType: "fixed",
    amount: input.amount,
    currency: input.currency,
  });
  if (!price.ok || price.value.amountMinor === null) return { ok: false, error: "amount" };

  const vatRateBasisPoints = parseVatRateBasisPoints(input.vatRate);
  if (vatRateBasisPoints === null) return { ok: false, error: "vat_rate" };

  const title = String(input.title ?? "").trim();
  if (!title || title.length > 160) return { ok: false, error: "title" };

  const terms = String(input.terms ?? "").trim();
  if (terms.length > 5_000) return { ok: false, error: "terms" };

  const validUntil = normalizeDate(input.validUntil);
  if (validUntil === undefined) return { ok: false, error: "valid_until" };

  const totals = calculateQuoteOfferTotals(price.value.amountMinor, vatRateBasisPoints);
  return {
    ok: true,
    value: {
      currency: input.currency,
      ...totals,
      title,
      terms,
      validUntil,
    },
  };
}
