import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";

export async function listAdminAuditLogs(limit = 200) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) return [];

  const safeLimit = Math.min(Math.max(limit, 1), 500);
  return sql`
    select l.id, l.action, l.reason, l.created_at,
      l.previous_value, l.new_value,
      u.name as admin_name, u.email as admin_email,
      w.name as workspace_name
    from admin_audit_logs l
    join "user" u on u.id = l.admin_user_id
    left join workspaces w on w.id = l.workspace_id
    order by l.created_at desc
    limit ${safeLimit}
  `;
}

export async function listActiveSupportSessions() {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) return [];

  return sql`
    select s.id, s.reason, s.mode, s.status, s.created_at, s.expires_at,
      w.name as workspace_name, w.slug as workspace_slug
    from admin_support_sessions s
    join workspaces w on w.id = s.workspace_id
    where s.admin_user_id = ${admin.userId}
      and s.status = 'active'
      and s.expires_at > now()
    order by s.created_at desc
  `;
}
