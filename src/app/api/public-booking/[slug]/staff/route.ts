import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const sql = getSql();
  if (!sql) return NextResponse.json({ staff: [] }, { status: 503 });

  const workspaces = await sql`
    select w.id
    from workspaces w
    where w.public_booking_slug = ${slug}
      and w.status in ('active', 'trial')
      and exists (
        select 1 from workspace_feature_flags wff
        where wff.workspace_id = w.id and wff.feature_key = 'booking_demo' and wff.enabled = true
      )
      and (
        select wp.status from workspace_plans wp
        where wp.workspace_id = w.id order by wp.created_at desc limit 1
      ) in ('active', 'trialing')
    limit 1
  `;
  const workspaceId = String(workspaces[0]?.id ?? "");
  if (!workspaceId) return NextResponse.json({ staff: [] }, { status: 404 });

  const [staffRows, scheduleRows, bookingRows, timeOffRows, holdRows] = await Promise.all([
    sql`select id, name, role_label from workspace_staff where workspace_id = ${workspaceId} and is_active = true order by sort_order, name`,
    sql`select staff_id, weekday, start_time::text as start_time, end_time::text as end_time from workspace_staff_schedules where workspace_id = ${workspaceId} and is_active = true order by staff_id, weekday, start_time`,
    sql`select staff_id, starts_at, ends_at from bookings where workspace_id = ${workspaceId} and staff_id is not null and status not in ('cancelled', 'no_show') and ends_at > now() - interval '1 day'`,
    sql`select staff_id, starts_at, ends_at from workspace_staff_time_off where workspace_id = ${workspaceId} and ends_at > now() - interval '1 day'`,
    sql`select staff_id, starts_at, ends_at from public_booking_verifications where workspace_id = ${workspaceId}::uuid and staff_id is not null and consumed_at is null and expires_at > now()`,
  ]);

  const staff = staffRows.map((row) => {
    const id = String(row.id);
    return {
      id,
      name: String(row.name),
      roleLabel: String(row.role_label ?? ""),
      schedules: scheduleRows.filter((item) => String(item.staff_id) === id).map((item) => ({
        weekday: Number(item.weekday),
        opensAt: String(item.start_time).slice(0, 5),
        closesAt: String(item.end_time).slice(0, 5),
        isClosed: false,
      })),
      busy: [...bookingRows, ...timeOffRows, ...holdRows]
        .filter((item) => String(item.staff_id) === id)
        .map((item) => ({ startsAt: new Date(item.starts_at as Date).toISOString(), endsAt: new Date(item.ends_at as Date).toISOString(), bufferBeforeMinutes: 0, bufferAfterMinutes: 0 })),
    };
  });

  return NextResponse.json({ staff }, { headers: { "Cache-Control": "no-store" } });
}
