import "server-only";

import { headers } from "next/headers";

import { getServerSession } from "@/lib/auth-session";
import { getSql } from "@/lib/db/server";

export type PlatformAdminRole =
  | "super_admin"
  | "support_admin"
  | "billing_admin"
  | "operations_admin"
  | "read_only_admin"
  | "developer_admin";

export async function getPlatformAdmin() {
  const session = await getServerSession();
  const userId = session?.user?.id;
  const sql = getSql();
  if (!userId || !sql) return null;

  const rows = await sql`
    select pa.role, u.email, u.name
    from platform_admins pa
    join "user" u on u.id = pa.user_id
    where pa.user_id = ${userId} and pa.is_active = true
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  return {
    userId,
    role: String(row.role) as PlatformAdminRole,
    email: String(row.email ?? ""),
    name: String(row.name ?? ""),
  };
}

export async function listAdminWorkspaces() {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) return [];

  return sql`
    select w.id, w.name, w.slug, w.status, w.public_booking_slug,
      coalesce(p.plan_key, 'none') as plan_key,
      coalesce(p.status, 'none') as plan_status,
      count(distinct wm.id)::int as member_count
    from workspaces w
    left join lateral (
      select plan_key, status
      from workspace_plans
      where workspace_id = w.id
      order by created_at desc
      limit 1
    ) p on true
    left join workspace_memberships wm on wm.workspace_id = w.id
    group by w.id, p.plan_key, p.status
    order by w.name asc
  `;
}

export async function listActiveSupportSessions() {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) return [];

  await sql`
    update admin_support_sessions
    set status = 'expired', updated_at = now()
    where status = 'active' and expires_at <= now()
  `;

  return sql`
    select s.id, s.reason, s.mode, s.expires_at, s.created_at,
      w.name as workspace_name, w.slug as workspace_slug,
      u.email as admin_email, u.name as admin_name
    from admin_support_sessions s
    join workspaces w on w.id = s.workspace_id
    join "user" u on u.id = s.admin_user_id
    where s.status = 'active' and s.expires_at > now()
    order by s.expires_at asc
  `;
}

export async function startReadOnlySupportSession(workspaceId: string, reason: string) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) throw new Error("Platform admin access required");
  const cleanReason = reason.trim();
  if (cleanReason.length < 8 || cleanReason.length > 500) throw new Error("A clear support reason is required");

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

  const rows = await sql.transaction((tx) => [
    tx`
      insert into admin_support_sessions (
        admin_user_id, workspace_id, reason, mode, status, expires_at
      ) values (
        ${admin.userId}, ${workspaceId}::uuid, ${cleanReason}, 'read_only', 'active', now() + interval '30 minutes'
      ) returning id, expires_at
    `,
  ]);
  const supportSession = rows[0]?.[0];
  if (!supportSession) throw new Error("Unable to start support session");

  await sql`
    insert into admin_audit_logs (
      admin_user_id, workspace_id, support_session_id, action, reason, ip_address, user_agent
    ) values (
      ${admin.userId}, ${workspaceId}::uuid, ${String(supportSession.id)}::uuid,
      'support_session.started', ${cleanReason}, ${forwardedFor}, ${userAgent}
    )
  `;

  return { id: String(supportSession.id), expiresAt: new Date(String(supportSession.expires_at)).toISOString() };
}

export async function getSupportSession(sessionId: string) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) return null;

  const rows = await sql`
    select s.id, s.reason, s.mode, s.expires_at, w.id as workspace_id,
      w.name, w.slug, w.status, w.public_booking_slug,
      ws.company_name, ws.primary_city, ws.contact_email, ws.contact_phone,
      coalesce(p.plan_key, 'none') as plan_key, coalesce(p.status, 'none') as plan_status
    from admin_support_sessions s
    join workspaces w on w.id = s.workspace_id
    left join workspace_settings ws on ws.workspace_id = w.id::text
    left join lateral (
      select plan_key, status from workspace_plans
      where workspace_id = w.id order by created_at desc limit 1
    ) p on true
    where s.id = ${sessionId}::uuid
      and s.admin_user_id = ${admin.userId}
      and s.status = 'active'
      and s.expires_at > now()
    limit 1
  `;
  return rows[0] ?? null;
}

export async function elevateSupportSession(sessionId: string, reason: string) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql || admin.role !== "super_admin") {
    throw new Error("Super admin access required");
  }

  const cleanReason = reason.trim();
  if (cleanReason.length < 12 || cleanReason.length > 500) {
    throw new Error("A clear edit reason is required");
  }

  const rows = await sql`
    update admin_support_sessions
    set mode = 'edit', expires_at = now() + interval '10 minutes', updated_at = now()
    where id = ${sessionId}::uuid
      and admin_user_id = ${admin.userId}
      and status = 'active'
      and expires_at > now()
    returning workspace_id
  `;
  const elevated = rows[0];
  if (!elevated) throw new Error("Active support session not found");

  await sql`
    insert into admin_audit_logs (
      admin_user_id, workspace_id, support_session_id, action, reason,
      previous_value, new_value
    ) values (
      ${admin.userId}, ${String(elevated.workspace_id)}::uuid, ${sessionId}::uuid,
      'support_session.edit_elevated', ${cleanReason},
      ${JSON.stringify({ mode: "read_only" })}::jsonb,
      ${JSON.stringify({ mode: "edit", duration_minutes: 10 })}::jsonb
    )
  `;
}

export async function downgradeSupportSession(sessionId: string) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) throw new Error("Platform admin access required");

  const rows = await sql`
    update admin_support_sessions
    set mode = 'read_only', expires_at = now() + interval '20 minutes', updated_at = now()
    where id = ${sessionId}::uuid
      and admin_user_id = ${admin.userId}
      and status = 'active'
      and mode = 'edit'
      and expires_at > now()
    returning workspace_id, reason
  `;
  const downgraded = rows[0];
  if (!downgraded) return;

  await sql`
    insert into admin_audit_logs (
      admin_user_id, workspace_id, support_session_id, action, reason,
      previous_value, new_value
    ) values (
      ${admin.userId}, ${String(downgraded.workspace_id)}::uuid, ${sessionId}::uuid,
      'support_session.edit_downgraded', ${String(downgraded.reason)},
      ${JSON.stringify({ mode: "edit" })}::jsonb,
      ${JSON.stringify({ mode: "read_only" })}::jsonb
    )
  `;
}

export async function endSupportSession(sessionId: string) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) throw new Error("Platform admin access required");

  const ownershipClause = admin.role === "super_admin" ? sql`` : sql`and admin_user_id = ${admin.userId}`;
  const rows = await sql`
    update admin_support_sessions
    set status = 'ended', ended_at = now(), updated_at = now()
    where id = ${sessionId}::uuid and status = 'active' ${ownershipClause}
    returning workspace_id, reason
  `;
  const ended = rows[0];
  if (ended) {
    await sql`
      insert into admin_audit_logs (admin_user_id, workspace_id, support_session_id, action, reason)
      values (${admin.userId}, ${String(ended.workspace_id)}::uuid, ${sessionId}::uuid, 'support_session.ended', ${String(ended.reason)})
    `;
  }
}

export async function listAdminAuditLogs(limit = 200) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) return [];
  const safeLimit = Math.min(Math.max(limit, 1), 500);

  return sql`
    select l.id, l.action, l.reason, l.created_at,
      u.email as admin_email, u.name as admin_name,
      w.name as workspace_name
    from admin_audit_logs l
    join "user" u on u.id = l.admin_user_id
    left join workspaces w on w.id = l.workspace_id
    order by l.created_at desc
    limit ${safeLimit}
  `;
}
