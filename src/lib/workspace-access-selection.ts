/**
 * Select only from memberships already returned by the server-side query.
 * A cookie can express a preference, never grant access to another workspace.
 */
export function selectWorkspaceMembership<T extends { workspaceId: string }>(
  memberships: readonly T[],
  preferredWorkspaceId: string,
) {
  return memberships.find((membership) => membership.workspaceId === preferredWorkspaceId)
    ?? memberships[0]
    ?? null;
}
