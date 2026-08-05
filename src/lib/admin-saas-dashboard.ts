import "server-only";

import { listAdminAuditLogs } from "@/lib/admin-audit";
import { listAdminWorkspaceDirectory } from "@/lib/admin-workspace-directory";
import { getPlatformAdmin, listActiveSupportSessions } from "@/lib/platform-admin";

export async function getAdminSaasDashboard() {
  const admin = await getPlatformAdmin();
  if (!admin) return null;

  const [workspaces, urgentWorkspaces, activeSessions, recentAudit] = await Promise.all([
    listAdminWorkspaceDirectory(),
    listAdminWorkspaceDirectory({ attentionOnly: true }),
    listActiveSupportSessions(),
    listAdminAuditLogs({}, 8),
  ]);

  const trialingCount = workspaces.filter((workspace) => workspace.plan_status === "trialing").length;
  const activePlanCount = workspaces.filter((workspace) => workspace.plan_status === "active").length;
  const pastDueCount = workspaces.filter((workspace) => workspace.plan_status === "past_due").length;
  const trialsEndingSoon = workspaces.filter((workspace) => workspace.trial_ending_soon).length;

  return {
    admin,
    summary: {
      totalWorkspaces: workspaces.length,
      attentionCount: urgentWorkspaces.length,
      trialingCount,
      activePlanCount,
      pastDueCount,
      trialsEndingSoon,
      activeSessionCount: activeSessions.length,
    },
    urgentWorkspaces: urgentWorkspaces.slice(0, 10),
    activeSessions: activeSessions.slice(0, 8),
    recentAudit,
  };
}
