import "server-only";

import { getSql } from "@/lib/db/server";
import { getPlatformAdmin, type PlatformAdminRole } from "@/lib/platform-admin";

export const PLATFORM_ADMIN_ROLES: PlatformAdminRole[] = [
  "super_admin",
  "support_admin",
  "billing_admin",
  "operations_admin",
  "read_only_admin",
  "developer_admin",
];

export async function listPlatformAdmins() {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql || admin.role !== "super_admin") return null;

  return sql`
    select pa.user_id, pa.role, pa.is_active, pa.created_at, pa.updated_at,
      u.name, u.email
    from platform_admins pa
    join "user" u on u.id = pa.user_id
    order by pa.is_active desc, u.email asc
  `;
}

export async function upsertPlatformAdmin(email: string, role: PlatformAdminRole, isActive: boolean) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql || admin.role !== "super_admin") throw new Error("Super admin access required");
  if (!PLATFORM_ADMIN_ROLES.includes(role)) throw new Error("Invalid platform admin role");

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || cleanEmail.length > 320) throw new Error("Valid email required");

  const users = await sql`select id, email, name from "user" where lower(email) = ${cleanEmail} limit 1`;
  const target = users[0];
  if (!target) throw new Error("User account not found");

  const existing = await sql`select role, is_active from platform_admins where user_id = ${String(target.id)} limit 1`;
  const previous = existing[0] ?? null;

  if (String(target.id) === admin.userId && (!isActive || role !== "super_admin")) {
    throw new Error("You cannot remove your own super admin access");
  }

  await sql.transaction((tx) => [
    tx`
      insert into platform_admins (user_id, role, is_active, created_at, updated_at)
      values (${String(target.id)}, ${role}, ${isActive}, now(), now())
      on conflict (user_id) do update
      set role = excluded.role, is_active = excluded.is_active, updated_at = now()
    `,
    tx`
      insert into admin_audit_logs (
        admin_user_id, action, reason, previous_value, new_value
      ) values (
        ${admin.userId}, 'platform_admin.updated', ${`Platform admin access updated for ${cleanEmail}`},
        ${JSON.stringify(previous)}::jsonb,
        ${JSON.stringify({ user_id: String(target.id), email: cleanEmail, role, is_active: isActive })}::jsonb
      )
    `,
  ]);
}
