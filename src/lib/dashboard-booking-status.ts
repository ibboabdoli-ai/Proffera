import { neon } from "@neondatabase/serverless";

import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const allowedBookingStatuses = ["requested", "confirmed", "completed", "cancelled"] as const;

export type DashboardBookingStatus = (typeof allowedBookingStatuses)[number];

export type DashboardBookingStatusUpdateResult = {
  changed: boolean;
};

function getSqlClient() {
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

async function getDashboardWorkspaceId() {
  const access = await getUserWorkspaceAccess();

  if (!access.ok) {
    return null;
  }

  return access.workspaceId;
}

export function isDashboardBookingStatus(value: string): value is DashboardBookingStatus {
  return allowedBookingStatuses.includes(value as DashboardBookingStatus);
}

export async function updateDashboardBookingStatus(
  bookingId: string,
  status: DashboardBookingStatus,
): Promise<DashboardBookingStatusUpdateResult> {
  const sql = getSqlClient();

  if (!sql) {
    throw new Error("Missing database connection for dashboard booking status update");
  }

  const workspaceId = await getDashboardWorkspaceId();

  if (!workspaceId) {
    throw new Error("Missing dashboard workspace access for dashboard booking status update");
  }

  const rows = await sql`
    with existing_booking as (
      select
        id,
        workspace_id,
        customer_id,
        status as old_status
      from bookings
      where workspace_id = ${workspaceId}
        and id = ${bookingId}
    ),
    updated_booking as (
      update bookings
      set
        status = ${status},
        updated_at = now()
      where workspace_id = ${workspaceId}
        and id = ${bookingId}
        and status <> ${status}
      returning
        id,
        workspace_id,
        customer_id,
        status as new_status
    ),
    inserted_event as (
      insert into customer_events (
        workspace_id,
        customer_id,
        booking_id,
        event_type,
        title,
        description,
        metadata
      )
      select
        updated_booking.workspace_id,
        updated_booking.customer_id,
        updated_booking.id,
        'status_change',
        'Booking status updated',
        'Status changed from ' || existing_booking.old_status || ' to ' || updated_booking.new_status || '.',
        jsonb_build_object(
          'source', 'dashboard_manual',
          'old_status', existing_booking.old_status,
          'new_status', updated_booking.new_status
        )
      from updated_booking
      join existing_booking on existing_booking.id = updated_booking.id
      returning id
    )
    select
      (select id from existing_booking limit 1) as booking_id,
      (select count(*)::int from updated_booking) as updated_count,
      (select count(*)::int from inserted_event) as event_count
  `;

  const result = rows[0];

  if (!result?.booking_id) {
    throw new Error("Booking status update did not match a booking");
  }

  return {
    changed: Number(result.updated_count ?? 0) > 0,
  };
}
