export const workspaceQuoteOfferStatuses = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "void",
] as const;

export type WorkspaceQuoteOfferStatus = (typeof workspaceQuoteOfferStatuses)[number];

const offerTransitions: Record<WorkspaceQuoteOfferStatus, readonly WorkspaceQuoteOfferStatus[]> = {
  draft: ["sent", "void"],
  sent: ["accepted", "rejected", "expired", "void"],
  accepted: [],
  rejected: [],
  expired: [],
  void: [],
};

export function isWorkspaceQuoteOfferStatus(value: unknown): value is WorkspaceQuoteOfferStatus {
  return typeof value === "string" && workspaceQuoteOfferStatuses.includes(value as WorkspaceQuoteOfferStatus);
}

export function canTransitionWorkspaceQuoteOffer(
  from: WorkspaceQuoteOfferStatus,
  to: WorkspaceQuoteOfferStatus,
) {
  return offerTransitions[from].includes(to);
}

export function calculateQuoteOfferTotals(subtotalMinor: number, vatRateBasisPoints: number) {
  if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor < 0) {
    throw new Error("Subtotal must be a non-negative safe integer");
  }
  if (!Number.isInteger(vatRateBasisPoints) || vatRateBasisPoints < 0 || vatRateBasisPoints > 10_000) {
    throw new Error("VAT rate must be between 0 and 10000 basis points");
  }

  const vatAmountMinor = Math.round((subtotalMinor * vatRateBasisPoints) / 10_000);
  const totalMinor = subtotalMinor + vatAmountMinor;

  if (!Number.isSafeInteger(totalMinor)) {
    throw new Error("Calculated offer total exceeds the safe integer range");
  }

  return { subtotalMinor, vatRateBasisPoints, vatAmountMinor, totalMinor };
}
