import type { QuoteRequestStatus } from "@/types/status";

export const QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES = [
  "submitted",
  "pending_review",
  "approved",
  "matched",
  "answered",
] as const satisfies readonly QuoteRequestStatus[];

export type QuoteRequestMatchingDeliveryStatus =
  (typeof QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES)[number];

const quoteRequestMatchingDeliveryStatuses = new Set<string>(
  QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES,
);

export function isQuoteRequestOpenForMatchingOrDelivery(
  value: unknown,
): value is QuoteRequestMatchingDeliveryStatus {
  return typeof value === "string" && quoteRequestMatchingDeliveryStatuses.has(value);
}
