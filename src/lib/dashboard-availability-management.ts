import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  resolveDatabaseUrl();

const blockSources = [
  "dashboard_availability_block",
  "dashboard_availability_recurring_block",
] as const;

export type DashboardAvailabilityBlock = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  source: string;
};

async function requireManagerAccess() {
  if (!connectionString) throw new Error("Missing database connection for availability management");
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("An owner or admin workspace membership is required for availability management");
  }
  return access;
}

export async function getDashboardAvailabilityBlocks(): Promise<DashboardAvailabilityBlock[]> {
  const access = await requireManagerAccess();
  const sql = neon(connectionString!);
  const rows = await sql`
    select id, title, starts_at, ends_at, source
    from bookings
    where workspace_id = ${access.workspaceId}
      and source in (${blockSources[0]}, ${blockSources[1]})
      and ends_at >= now()
    order by starts_at asc
    limit 300
  `;

  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Blockerad tid"),
    startsAt: new Date(String(row.starts_at)).toISOString(),
    endsAt: new Date(String(row.ends_at)).toISOString(),
    source: String(row.source),
  }));
}

export async function deleteDashboardAvailabilityBlock(blockId: string) {
  const access = await requireManagerAccess();
  const sql = neon(connectionString!);
  const rows = await sql`
    delete from bookings
    where id = ${blockId}
      and workspace_id = ${access.workspaceId}
      and source in (${blockSources[0]}, ${blockSources[1]})
    returning id
  `;

  if (!rows[0]) throw new Error("Availability block was not found in the active workspace");
  return { id: String(rows[0].id) };
}
