import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveBookingTimeZone } from "@/lib/public-booking-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

export type StaffBookingAssignmentRow = {
  id: string;
  title: string;
  customerName: string;
  service: string;
  startsAt: string;
  endsAt: string;
  status: string;
  staffId: string;
  staffName: string;
};

async function requireManager() {
  if (!connectionString) throw new Error("Missing database connection for staff booking assignment");
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("Owner or admin workspace access is required");
  }
  return access;
}

export async function getStaffBookingAssignments(): Promise<StaffBookingAssignmentRow[]> {
  if (!connectionString) return [];
  const access = await getUserWorkspaceAccess();
  if (!access.ok) throw new Error("Workspace access is required");
  const sql = neon(connectionString);
  const rows = await sql`
    select
      b.id,
      b.title,
      b.service,
      b.starts_at,
      b.ends_at,
      b.status,
      b.staff_id,
      c.name as customer_name,
      s.name as staff_name
    from bookings b
    left join customers c
      on c.id = b.customer_id
     and c.workspace_id = b.workspace_id
    left join workspace_staff s
      on s.id = b.staff_id
     and s.workspace_id = b.workspace_id
    where b.workspace_id = ${access.workspaceId}
      and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
      and b.starts_at >= now() - interval '30 days'
    order by b.starts_at asc
    limit 500
  `;
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? "Bokning"),
    customerName: String(row.customer_name ?? "Okänd kund"),
    service: String(row.service ?? "Ej vald tjänst"),
    startsAt: new Date(String(row.starts_at)).toISOString(),
    endsAt: new Date(String(row.ends_at)).toISOString(),
    status: String(row.status ?? "requested"),
    staffId: String(row.staff_id ?? ""),
    staffName: String(row.staff_name ?? ""),
  }));
}

export async function assignStaffToBooking(bookingId: string, staffId: string) {
  const access = await requireManager();
  const sql = neon(connectionString!);
  const marketRows = await sql`
    select time_zone
    from workspace_settings
    where workspace_id = ${access.workspaceId}
    limit 1
  `;
  const timeZone = resolveBookingTimeZone(marketRows[0]?.time_zone);

  if (staffId) {
    const staffRows = await sql`
      select id
      from workspace_staff
      where id = ${staffId}
        and workspace_id = ${access.workspaceId}
        and is_active = true
      limit 1
    `;
    if (!staffRows[0]) throw new Error("Active staff member not found");
  }

  const bookingRows = await sql`
    select id, starts_at, ends_at
    from bookings
    where id = ${bookingId}
      and workspace_id = ${access.workspaceId}
      and source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `;
  const booking = bookingRows[0];
  if (!booking) throw new Error("Booking not found");

  if (staffId) {
    const startsAt = new Date(String(booking.starts_at)).toISOString();
    const endsAt = new Date(String(booking.ends_at)).toISOString();

    const availabilityRows = await sql`
      select
        exists(
          select 1
          from workspace_staff_schedules ss
          where ss.workspace_id = ${access.workspaceId}
            and ss.staff_id = ${staffId}::uuid
            and ss.is_active = true
        ) as has_schedule,
        exists(
          select 1
          from workspace_staff_schedules ss
          where ss.workspace_id = ${access.workspaceId}
            and ss.staff_id = ${staffId}::uuid
            and ss.is_active = true
            and ss.weekday = extract(dow from (${startsAt}::timestamptz at time zone ${timeZone}))::int
            and ss.start_time <= (${startsAt}::timestamptz at time zone ${timeZone})::time
            and ss.end_time >= (${endsAt}::timestamptz at time zone ${timeZone})::time
            and (${startsAt}::timestamptz at time zone ${timeZone})::date = (${endsAt}::timestamptz at time zone ${timeZone})::date
        ) as inside_schedule,
        exists(
          select 1
          from workspace_staff_time_off t
          where t.workspace_id = ${access.workspaceId}
            and t.staff_id = ${staffId}::uuid
            and t.starts_at < ${endsAt}::timestamptz
            and t.ends_at > ${startsAt}::timestamptz
        ) as has_time_off
    `;
    const availability = availabilityRows[0];
    if (Boolean(availability?.has_time_off)) throw new Error("Staff time off conflict");
    if (Boolean(availability?.has_schedule) && !Boolean(availability?.inside_schedule)) {
      throw new Error("Booking is outside staff working hours");
    }

    const conflictRows = await sql`
      select id
      from bookings
      where workspace_id = ${access.workspaceId}
        and staff_id = ${staffId}::uuid
        and id <> ${bookingId}
        and status not in ('cancelled', 'no_show')
        and starts_at < ${endsAt}::timestamptz
        and ends_at > ${startsAt}::timestamptz
      limit 1
    `;
    if (conflictRows[0]) throw new Error("Staff booking conflict");
  }

  const updated = await sql`
    update bookings
    set staff_id = ${staffId || null}::uuid,
        updated_at = now()
    where id = ${bookingId}
      and workspace_id = ${access.workspaceId}
    returning id
  `;
  if (!updated[0]) throw new Error("Booking assignment failed");
}
