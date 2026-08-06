import "server-only";

import {
  canActivatePlatformAdmin,
  PlatformAdminManagementError,
} from "@/lib/platform-admin-assignment-policy";
import { getSql } from "@/lib/db/server";
import { getPlatformAdmin, type PlatformAdminRole } from "@/lib/platform-admin";

export { PlatformAdminManagementError } from "@/lib/platform-admin-assignment-policy";

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
      u.name, u.email,
      (
        select count(*)::int
        from workspace_memberships wm
        where wm.user_id = pa.user_id
      ) as workspace_membership_count
    from platform_admins pa
    join "user" u on u.id = pa.user_id
    order by pa.is_active desc, u.email asc
  `;
}

export async function upsertPlatformAdmin(email: string, role: PlatformAdminRole, isActive: boolean) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql || admin.role !== "super_admin") throw new Error("Super admin access required");
  if (!PLATFORM_ADMIN_ROLES.includes(role)) throw new PlatformAdminManagementError("invalid_role");

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || cleanEmail.length > 320) throw new PlatformAdminManagementError("invalid_email");

  const users = await sql`
    select u.id, u.email, u.name,
      pa.role as existing_role,
      pa.is_active as existing_is_active,
      count(wm.id)::int as workspace_membership_count
    from "user" u
    left join platform_admins pa on pa.user_id = u.id
    left join workspace_memberships wm on wm.user_id = u.id
    where lower(u.email) = ${cleanEmail}
    group by u.id, u.email, u.name, pa.role, pa.is_active
    limit 1
  `;
  const target = users[0];
  if (!target) throw new PlatformAdminManagementError("user_not_found");

  const targetUserId = String(target.id);
  const existingActive = target.existing_is_active === true;
  const workspaceMembershipCount = Number(target.workspace_membership_count ?? 0);
  const previous = target.existing_role == null
    ? null
    : {
        role: String(target.existing_role),
        is_active: existingActive,
      };

  if (targetUserId === admin.userId && (!isActive || role !== "super_admin")) {
    throw new PlatformAdminManagementError("self_protection");
  }

  if (!canActivatePlatformAdmin({
    requestedActive: isActive,
    existingActive,
    workspaceMembershipCount,
  })) {
    throw new PlatformAdminManagementError("workspace_member");
  }

  const mutationRows = await sql`
    with eligible as (
      select ${targetUserId}::text as user_id
      where not (
        ${isActive}
        and not ${existingActive}
        and exists (
          select 1
          from workspace_memberships wm
          where wm.user_id = ${targetUserId}
        )
      )
    ),
    upserted as (
      insert into platform_admins (user_id, role, is_active, created_at, updated_at)
      select user_id, ${role}, ${isActive}, now(), now()
      from eligible
      on conflict (user_id) do update
      set role = excluded.role, is_active = excluded.is_active, updated_at = now()
      returning user_id, role, is_active
    )
    insert into admin_audit_logs (
      admin_user_id, action, reason, previous_value, new_value
    )
    select
      ${admin.userId},
      'platform_admin.updated',
      ${`Platform admin access updated for ${cleanEmail}`},
      ${JSON.stringify(previous)}::jsonb,
      jsonb_build_object(
        'user_id', upserted.user_id,
        'email', ${cleanEmail},
        'role', upserted.role,
        'is_active', upserted.is_active
      )
    from upserted
    returning id
  `;

  if (mutationRows.length === 0) {
    throw new PlatformAdminManagementError("workspace_member");
  }
}
