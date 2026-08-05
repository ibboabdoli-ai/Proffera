import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";

export type AdminAuditFilters = {
  workspaceId?: string;
  adminUserId?: string;
  action?: string;
};

export async function listAdminAuditFilterOptions() {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) return { workspaces: [], admins: [], actions: [] };

  const [workspaces, admins, actions] = await Promise.all([
    sql`select id, name from workspaces order by name asc`,
    sql`
      select distinct u.id, u.name, u.email
      from admin_audit_logs l
      join "user" u on u.id = l.admin_user_id
      order by coalesce(u.name, u.email) asc
    `,
    sql`
      select distinct action
      from admin_audit_logs
      where action is not null and action <> ''
      order by action asc
    `,
  ]);

  return { workspaces, admins, actions };
}

export async function listAdminAuditLogs(filters: AdminAuditFilters = {}, limit = 200) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) return [];

  const safeLimit = Math.min(Math.max(limit, 1), 500);
  const workspaceId = filters.workspaceId?.trim() || null;
  const adminUserId = filters.adminUserId?.trim() || null;
  const action = filters.action?.trim() || null;

  return sql`
    select l.id, l.action, l.reason, l.created_at,
      l.previous_value, l.new_value,
      u.id as admin_user_id, u.name as admin_name, u.email as admin_email,
      w.id as workspace_id, w.name as workspace_name
    from admin_audit_logs l
    join "user" u on u.id = l.admin_user_id
    left join workspaces w on w.id = l.workspace_id
    where (${workspaceId}::uuid is null or l.workspace_id = ${workspaceId}::uuid)
      and (${adminUserId} is null or l.admin_user_id = ${adminUserId})
      and (${action} is null or l.action = ${action})
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
