export const workspaceServiceJobStatuses = [
  "new",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type WorkspaceServiceJobStatus = (typeof workspaceServiceJobStatuses)[number];

const allowedTransitions: Record<WorkspaceServiceJobStatus, readonly WorkspaceServiceJobStatus[]> = {
  new: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isWorkspaceServiceJobStatus(value: unknown): value is WorkspaceServiceJobStatus {
  return typeof value === "string" && workspaceServiceJobStatuses.includes(value as WorkspaceServiceJobStatus);
}

export function getWorkspaceServiceJobTransitions(status: WorkspaceServiceJobStatus) {
  return allowedTransitions[status];
}

export function canTransitionWorkspaceServiceJob(
  from: WorkspaceServiceJobStatus,
  to: WorkspaceServiceJobStatus,
) {
  return allowedTransitions[from].includes(to);
}
