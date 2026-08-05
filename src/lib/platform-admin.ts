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

export async function getReadOnlySupportSession(sessionId: string) {
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
      and s.mode = 'read_only'
      and s.expires_at > now()
    limit 1
  `;
  return rows[0] ?? null;
}

export async function endSupportSession(sessionId: string) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) throw new Error("Platform admin access required");

  const rows = await sql`
    update admin_support_sessions
    set status = 'ended', ended_at = now(), updated_at = now()
    where id = ${sessionId}::uuid and admin_user_id = ${admin.userId} and status = 'active'
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
