import "server-only";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceMembers, canManageWorkspaceSettings, getUserWorkspaceAccess, type WorkspaceRole } from "@/lib/workspace-access";

const editableRoles = ["admin", "staff", "viewer"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EditableWorkspaceRole = (typeof editableRoles)[number];
export type WorkspaceMember = { membershipId: string; name: string; email: string; role: WorkspaceRole; isCurrentUser: boolean };
export type MemberResult = { ok: true } | { ok: false; code: "access" | "invalid" | "not_found" | "exists" | "protected" | "database" };

export function isEditableWorkspaceRole(value: string): value is EditableWorkspaceRole {
  return editableRoles.includes(value as EditableWorkspaceRole);
}

export async function getWorkspaceMembers(): Promise<WorkspaceMember[]> {
  const access = await getUserWorkspaceAccess();
  const sql = getSql();
  if (!access.ok || !canManageWorkspaceSettings(access) || !sql) return [];

  try {
    const rows = await sql`
      select wm.id as membership_id, wm.user_id, wm.role, u.name, u.email
      from workspace_memberships wm join "user" u on u.id = wm.user_id
      where wm.workspace_id = ${access.workspaceId}::uuid
      order by case wm.role when 'owner' then 0 when 'admin' then 1 when 'staff' then 2 else 3 end, lower(u.name)
    `;
    return rows.map((row) => ({
      membershipId: String(row.membership_id), name: String(row.name), email: String(row.email),
      role: String(row.role) as WorkspaceRole, isCurrentUser: String(row.user_id) === access.userId,
    }));
  } catch (error) {
    console.error("Failed to read workspace members", error);
    return [];
  }
}

export async function addExistingWorkspaceMember(email: string, role: EditableWorkspaceRole): Promise<MemberResult> {
  const access = await getUserWorkspaceAccess();
  const sql = getSql();
  if (!access.ok || !canManageWorkspaceMembers(access)) return { ok: false, code: "access" };
  if (!sql || !email || email.length > 180 || !isEditableWorkspaceRole(role)) return { ok: false, code: "invalid" };

  try {
    const users = await sql`select id from "user" where lower(email) = lower(${email}) limit 1`;
    const userId = String(users[0]?.id ?? "");
    if (!userId) return { ok: false, code: "not_found" };
    const rows = await sql`
      insert into workspace_memberships (id, workspace_id, user_id, role, created_at, updated_at)
      values (gen_random_uuid(), ${access.workspaceId}::uuid, ${userId}, ${role}, now(), now())
      on conflict (workspace_id, user_id) do nothing returning id
    `;
    return rows[0]?.id ? { ok: true } : { ok: false, code: "exists" };
  } catch (error) {
    console.error("Failed to add workspace member", error);
    return { ok: false, code: "database" };
  }
}

export async function updateWorkspaceMemberRole(id: string, role: EditableWorkspaceRole): Promise<MemberResult> {
  const access = await getUserWorkspaceAccess();
  const sql = getSql();
  if (!access.ok || !canManageWorkspaceMembers(access)) return { ok: false, code: "access" };
  if (!sql || !uuidPattern.test(id) || !isEditableWorkspaceRole(role)) return { ok: false, code: "invalid" };
  try {
    const rows = await sql`
      update workspace_memberships set role = ${role}, updated_at = now()
      where id = ${id}::uuid and workspace_id = ${access.workspaceId}::uuid and role <> 'owner' returning id
    `;
    return rows[0]?.id ? { ok: true } : { ok: false, code: "protected" };
  } catch (error) {
    console.error("Failed to update member role", error);
    return { ok: false, code: "database" };
  }
}

export async function removeWorkspaceMember(id: string): Promise<MemberResult> {
  const access = await getUserWorkspaceAccess();
  const sql = getSql();
  if (!access.ok || !canManageWorkspaceMembers(access)) return { ok: false, code: "access" };
  if (!sql || !uuidPattern.test(id)) return { ok: false, code: "invalid" };
  try {
    const rows = await sql`
      delete from workspace_memberships
      where id = ${id}::uuid and workspace_id = ${access.workspaceId}::uuid and role <> 'owner' returning id
    `;
    return rows[0]?.id ? { ok: true } : { ok: false, code: "protected" };
  } catch (error) {
    console.error("Failed to remove workspace member", error);
    return { ok: false, code: "database" };
  }
}
