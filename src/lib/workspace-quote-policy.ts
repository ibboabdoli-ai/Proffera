export const workspaceQuoteStatuses = [
  "submitted",
  "reviewing",
  "quoted",
  "accepted",
  "rejected",
  "cancelled",
] as const;

export type WorkspaceQuoteStatus = (typeof workspaceQuoteStatuses)[number];

const allowedTransitions: Record<WorkspaceQuoteStatus, readonly WorkspaceQuoteStatus[]> = {
  submitted: ["reviewing", "cancelled"],
  reviewing: ["quoted", "rejected", "cancelled"],
  quoted: ["accepted", "rejected", "cancelled"],
  accepted: [],
  rejected: [],
  cancelled: [],
};

export function isWorkspaceQuoteStatus(value: unknown): value is WorkspaceQuoteStatus {
  return typeof value === "string" && workspaceQuoteStatuses.includes(value as WorkspaceQuoteStatus);
}

export function getWorkspaceQuoteTransitions(status: WorkspaceQuoteStatus) {
  return allowedTransitions[status];
}

export function canTransitionWorkspaceQuote(
  from: WorkspaceQuoteStatus,
  to: WorkspaceQuoteStatus,
) {
  return allowedTransitions[from].includes(to);
}