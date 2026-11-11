import "server-only";
import { getSql } from "@/lib/db/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const mariaSoftDeleteStatuses = ["cancelled", "completed", "no_show"] as const;

// Deletion is a reversible archive of a TERMINAL booking only. It never
// cancels a booking, releases a paid timeslot or triggers any refund/email/SMS.
export async function changeMariaBookingSoftDelete(input: {
  workspaceId: string; bookingId: string; actorId: string; action: "hide" | "restore";
}): Promise<"updated" | "unchanged" | "unavailable"> {
  if (!uuid.test(input.workspaceId) || !uuid.test(input.bookingId)
    || !input.actorId || input.actorId.length > 255) return "unavailable";
  const sql = getSql();
  if (!sql) return "unavailable";
  try {
    if (input.action === "hide") {
      const rows = await sql`
        with eligible as (
          select b.id from bookings b
          join workspaces w on w.id::text=b.workspace_id and w.slug='makeup-by-maria'
          where b.workspace_id=${input.workspaceId}
            and b.id=${input.bookingId}::uuid
            and b.status in ('cancelled','completed','no_show')
          for update of b
        ), changed as (
          insert into booking_soft_deletions (workspace_id,booking_id,deleted_by)
          select ${input.workspaceId}::uuid,id,${input.actorId} from eligible
          on conflict (workspace_id,booking_id) do update
          set deleted_at=now(),deleted_by=excluded.deleted_by,
              restored_at=null,restored_by=null
          where booking_soft_deletions.restored_at is not null
          returning booking_id
        ), audit as (
          insert into booking_soft_delete_events(workspace_id,booking_id,action,actor_id)
          select ${input.workspaceId}::uuid,booking_id,'hide',${input.actorId} from changed
          returning id
        )
        select (select count(*) from audit)::int as count
      `;
      return Number(rows[0]?.count) === 1 ? "updated" : "unchanged";
    }
    const rows = await sql`
      with changed as (
        update booking_soft_deletions d
        set restored_at=now(),restored_by=${input.actorId}
        where d.workspace_id=${input.workspaceId}::uuid
          and d.booking_id=${input.bookingId}::uuid
          and d.restored_at is null
          and exists (select 1 from bookings b
            join workspaces w on w.id::text=b.workspace_id and w.slug='makeup-by-maria'
            where b.id=d.booking_id and b.workspace_id=${input.workspaceId})
        returning booking_id
      ), audit as (
        insert into booking_soft_delete_events(workspace_id,booking_id,action,actor_id)
        select ${input.workspaceId}::uuid,booking_id,'restore',${input.actorId} from changed
        returning id
      )
      select (select count(*) from audit)::int as count
    `;
    return Number(rows[0]?.count) === 1 ? "updated" : "unchanged";
  } catch (error) {
    console.error("Maria booking archive transaction failed", error);
    return "unavailable";
  }
}

export async function listMariaArchivedBookings(workspaceId: string) {
  const sql = getSql();
  if (!sql || !uuid.test(workspaceId)) return [];
  try {
    const rows = await sql`
      select b.id,b.title,b.status,d.deleted_at
      from booking_soft_deletions d
      join bookings b on b.id=d.booking_id and b.workspace_id=d.workspace_id::text
      join workspaces w on w.id=d.workspace_id and w.slug='makeup-by-maria'
      where d.workspace_id=${workspaceId}::uuid and d.restored_at is null
      order by d.deleted_at desc limit 50
    `;
    return rows.map(row => ({
      id: String(row.id), title: String(row.title), status: String(row.status),
      deletedAt: new Date(String(row.deleted_at)).toISOString(),
    }));
  } catch (error) {
    console.error("Maria booking archive unavailable", error);
    return [];
  }
}
