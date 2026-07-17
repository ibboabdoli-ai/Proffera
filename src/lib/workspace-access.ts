import "server-only";

import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";

import { getServerSession } from "@/lib/auth-session";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const workspaceRoles = ["owner", "admin", "staff", "viewer"] as const;
const allowedWorkspaceStatuses = ["active", "trial"] as const;
export const selectedWorkspaceCookieName = "proffera_workspace_id";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkspaceRole = (typeof workspaceRoles)[number];
export type AllowedWorkspaceStatus = (typeof allowedWorkspaceStatuses)[number];
export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
};

export type WorkspaceAccessFailureReason =
  | "no_session"
  | "no_user"
  | "no_membership"
  | "workspace_not_allowed";

export type WorkspaceAccessResult =
  | {
      ok: true;
      userId: string;
      workspaceId: string;
      workspaceSlug: string;
      workspaceName: string;
      workspaceStatus: AllowedWorkspaceStatus;
      role: WorkspaceRole;
    }
  | {
      ok: false;
      reason: WorkspaceAccessFailureReason;
  };

export function canManageWorkspaceSettings(access: WorkspaceAccessResult) {
  return access.ok && (access.role === "owner" || access.role === "admin");
}

export function canManageWorkspaceMembers(access: WorkspaceAccessResult) {
  return access.ok && access.role === "owner";
}

function getSqlClient() {
  return connectionString ? neon(connectionString) : null;
}

function toText(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && workspaceRoles.includes(value as WorkspaceRole);
}

function isAllowedWorkspaceStatus(value: unknown): value is AllowedWorkspaceStatus {
  return typeof value === "string" && allowedWorkspaceStatuses.includes(value as AllowedWorkspaceStatus);
}

export async function getUserWorkspaceAccess(): Promise<WorkspaceAccessResult> {
  const session = await getServerSession();

  if (!session) {
    return { ok: false, reason: "no_session" };
  }

  const userId = session.user?.id;

  if (!userId) {
    return { ok: false, reason: "no_user" };
  }

  const sql = getSqlClient();

  if (!sql) {
    return { ok: false, reason: "workspace_not_allowed" };
  }

  try {
    const cookieStore = await cookies();
    const cookieWorkspaceId = cookieStore.get(selectedWorkspaceCookieName)?.value ?? "";
    const selectedWorkspaceId = uuidPattern.test(cookieWorkspaceId) ? cookieWorkspaceId : "";
    const userRows = await sql`
      select id
      from "user"
      where id = ${userId}
      limit 1
    `;

    if (!userRows[0]) {
      return { ok: false, reason: "no_user" };
    }

    const workspaceRows = await sql`
      select
        wm.workspace_id,
        wm.role,
        w.slug as workspace_slug,
        w.name as workspace_name,
        w.status as workspace_status
      from workspace_memberships wm
      join workspaces w on w.id = wm.workspace_id
      where wm.user_id = ${userId}
        and w.status in ('active', 'trial')
      order by
        case when w.id::text = ${selectedWorkspaceId} then 0 else 1 end,
        wm.created_at asc
      limit 1
    `;

    const workspaceRow = workspaceRows[0];

    if (!workspaceRow) {
      return { ok: false, reason: "no_membership" };
    }

    const role = workspaceRow.role;
    const workspaceStatus = workspaceRow.workspace_status;
    const workspaceId = toText(workspaceRow.workspace_id);
    const workspaceSlug = toText(workspaceRow.workspace_slug);
    const workspaceName = toText(workspaceRow.workspace_name);

    if (!isWorkspaceRole(role) || !isAllowedWorkspaceStatus(workspaceStatus)) {
      return { ok: false, reason: "workspace_not_allowed" };
    }

    if (!workspaceId || !workspaceSlug || !workspaceName) {
      return { ok: false, reason: "workspace_not_allowed" };
    }

    return {
      ok: true,
      userId,
      workspaceId,
      workspaceSlug,
      workspaceName,
      workspaceStatus,
      role,
    };
  } catch (error) {
    console.error("Failed to read workspace access", error);

    return { ok: false, reason: "workspace_not_allowed" };
  }
}

export async function getUserWorkspaceOptions(): Promise<WorkspaceOption[]> {
  const session = await getServerSession();
  const userId = session?.user?.id;
  const sql = getSqlClient();

  if (!userId || !sql) return [];

  try {
    const rows = await sql`
      select w.id, w.name, w.slug, wm.role
      from workspace_memberships wm
      join workspaces w on w.id = wm.workspace_id
      where wm.user_id = ${userId}
        and w.status in ('active', 'trial')
      order by w.name asc, wm.created_at asc
    `;

    return rows.flatMap((row) => {
      const id = toText(row.id);
      const name = toText(row.name);
      const slug = toText(row.slug);
      const role = row.role;

      return id && name && slug && isWorkspaceRole(role) ? [{ id, name, slug, role }] : [];
    });
  } catch (error) {
    console.error("Failed to read workspace options", error);
    return [];
  }
}
