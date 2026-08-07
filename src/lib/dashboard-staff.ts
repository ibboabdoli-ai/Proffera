import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  resolveDatabaseUrl();

export type DashboardStaffMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  roleLabel: string;
  isActive: boolean;
};

async function requireManager() {
  if (!connectionString) throw new Error("Missing database connection for staff management");
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("Owner or admin workspace access is required");
  }
  return access;
}

export async function getDashboardStaff(): Promise<DashboardStaffMember[]> {
  if (!connectionString) return [];
  const access = await getUserWorkspaceAccess();
  if (!access.ok) throw new Error("Workspace access is required");
  const sql = neon(connectionString);
  try {
    const rows = await sql`
      select id, name, email, phone, role_label, is_active
      from workspace_staff
      where workspace_id = ${access.workspaceId}
      order by is_active desc, sort_order asc, name asc
    `;
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      email: String(row.email ?? ""),
      phone: String(row.phone ?? ""),
      roleLabel: String(row.role_label ?? ""),
      isActive: Boolean(row.is_active),
    }));
  } catch (error) {
    console.error("Failed to read workspace staff", error);
    return [];
  }
}

export async function createDashboardStaffMember(input: {
  name: string;
  email: string;
  phone: string;
  roleLabel: string;
}) {
  const access = await requireManager();
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Staff name is required");
  const sql = neon(connectionString!);
  const rows = await sql`
    insert into workspace_staff (workspace_id, name, email, phone, role_label)
    values (
      ${access.workspaceId},
      ${name},
      ${input.email.trim().slice(0, 200)},
      ${input.phone.trim().slice(0, 50)},
      ${input.roleLabel.trim().slice(0, 120)}
    )
    returning id
  `;
  return String(rows[0]?.id ?? "");
}

export async function setDashboardStaffActive(staffId: string, isActive: boolean) {
  const access = await requireManager();
  const sql = neon(connectionString!);
  const rows = await sql`
    update workspace_staff
    set is_active = ${isActive}, updated_at = now()
    where id = ${staffId} and workspace_id = ${access.workspaceId}
    returning id
  `;
  if (!rows[0]) throw new Error("Staff member not found");
}
