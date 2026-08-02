import "server-only";

import { neon } from "@neondatabase/serverless";
import { cookies } from "next/headers";

import { getServerSession } from "@/lib/auth-session";
import { selectWorkspaceMembership } from "@/lib/workspace-access-selection";
import {
  canRoleManageWorkspaceMembers,
  canRoleManageWorkspaceSettings,
  isWorkspaceRole,
  type WorkspaceRole,
} from "@/lib/workspace-role-policy";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const allowedWorkspaceStatuses = ["active", "trial"] as const;
export const selectedWorkspaceCookieName = "proffera_workspace_id";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type { WorkspaceRole } from "@/lib/workspace-role-policy";
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

type ValidWorkspaceMembership = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  workspaceStatus: AllowedWorkspaceStatus;
  role: WorkspaceRole;
};

export function canManageWorkspaceSettings(access: WorkspaceAccessResult) {
  return access.ok && canRoleManageWorkspaceSettings(access.role);
}

export function canManageWorkspaceMembers(access: WorkspaceAccessResult) {
  return access.ok && canRoleManageWorkspaceMembers(access.role);
}

function getSqlClient() {
  return connectionString ? neon(connectionString) : null;
}

function toText(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
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
      order by wm.created_at asc
    `;

    if (!workspaceRows[0]) {
      return { ok: false, reason: "no_membership" };
    }
    const memberships = workspaceRows.flatMap((workspaceRow) => {
      const role = workspaceRow.role;
      const workspaceStatus = workspaceRow.workspace_status;
      const workspaceId = toText(workspaceRow.workspace_id);
      const workspaceSlug = toText(workspaceRow.workspace_slug);
      const workspaceName = toText(workspaceRow.workspace_name);

      if (!isWorkspaceRole(role) || !isAllowedWorkspaceStatus(workspaceStatus) || !workspaceId || !workspaceSlug || !workspaceName) {
        return [];
      }

      return [{ workspaceId, workspaceSlug, workspaceName, workspaceStatus, role } satisfies ValidWorkspaceMembership];
    });
    const workspace = selectWorkspaceMembership(memberships, selectedWorkspaceId);

    if (!workspace) {
      return { ok: false, reason: "workspace_not_allowed" };
    }

    return {
      ok: true,
      userId,
      ...workspace,
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
