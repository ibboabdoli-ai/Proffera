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
    with lock_guard as materialized (
      select pg_advisory_xact_lock(74821, 34901)
    ),
    current_target as materialized (
      select
        ${targetUserId}::text as user_id,
        pa.role as existing_role,
        coalesce(pa.is_active, false) as existing_is_active,
        exists (
          select 1
          from workspace_memberships wm
          where wm.user_id = ${targetUserId}
        ) as has_workspace_membership,
        exists (
          select 1
          from platform_admins actor
          where actor.user_id = ${admin.userId}
            and actor.role = 'super_admin'
            and actor.is_active = true
        ) as actor_is_super_admin
      from lock_guard
      left join platform_admins pa on pa.user_id = ${targetUserId}
    ),
    eligibility as materialized (
      select
        current_target.*,
        case
          when not current_target.actor_is_super_admin
            then 'access_revoked'
          when ${isActive}
            and not current_target.existing_is_active
            and current_target.has_workspace_membership
            then 'workspace_member'
          when current_target.existing_role = 'super_admin'
            and current_target.existing_is_active
            and (not ${isActive} or ${role} <> 'super_admin')
            and not exists (
              select 1
              from platform_admins other
              where other.user_id <> current_target.user_id
                and other.role = 'super_admin'
                and other.is_active = true
            )
            then 'last_super_admin'
          else 'ok'
        end as outcome
      from current_target
    ),
    upserted as (
      insert into platform_admins (user_id, role, is_active, created_at, updated_at)
      select user_id, ${role}, ${isActive}, now(), now()
      from eligibility
      where outcome = 'ok'
      on conflict (user_id) do update
      set role = excluded.role, is_active = excluded.is_active, updated_at = now()
      returning user_id, role, is_active
    ),
    audited as (
      insert into admin_audit_logs (
        admin_user_id, action, reason, previous_value, new_value
      )
      select
        ${admin.userId},
        'platform_admin.updated',
        ${`Platform admin access updated for ${cleanEmail}`},
        case
          when eligibility.existing_role is null then null
          else jsonb_build_object(
            'role', eligibility.existing_role,
            'is_active', eligibility.existing_is_active
          )
        end,
        jsonb_build_object(
          'user_id', upserted.user_id,
          'email', ${cleanEmail},
          'role', upserted.role,
          'is_active', upserted.is_active
        )
      from upserted
      join eligibility on eligibility.user_id = upserted.user_id
      returning id
    )
    select
      eligibility.outcome,
      (select id from audited limit 1) as audit_id
    from eligibility
  `;

  const outcome = String(mutationRows[0]?.outcome ?? "");
  if (outcome === "workspace_member") {
    throw new PlatformAdminManagementError("workspace_member");
  }
  if (outcome === "last_super_admin") {
    throw new PlatformAdminManagementError("last_super_admin");
  }
  if (outcome === "access_revoked") {
    throw new PlatformAdminManagementError("access_revoked");
  }
  if (outcome !== "ok" || !mutationRows[0]?.audit_id) {
    throw new Error("Platform admin update was not persisted and audited");
  }
}
