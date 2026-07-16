import "server-only";

import { neon } from "@neondatabase/serverless";

import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const LEGACY_WORKSPACE_ID = "__legacy_workspace_access_disabled__";

const allowedBookingStatuses = ["requested", "confirmed", "completed", "cancelled"] as const;

export type DashboardBookingStatus = (typeof allowedBookingStatuses)[number];

export type DashboardBookingStatusUpdateResult = {
  changed: boolean;
  notification: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    service: string;
    city: string;
    startsAt: string;
    endsAt: string;
  } | null;
};

function getSqlClient() {
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

async function getActiveWorkspaceId() {
  const access = await getUserWorkspaceAccess();

  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("An owner or admin workspace membership is required for booking updates");
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

  const workspaceId = await getActiveWorkspaceId();

  const rows = await sql`
    with existing_booking as (
      select
        b.id,
        b.workspace_id,
        b.customer_id,
        b.status as old_status,
        b.service,
        b.city,
        b.starts_at,
        b.ends_at,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone
      from bookings b
      left join customers c on c.id = b.customer_id
      where b.workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
        and b.id = ${bookingId}
    ),
    updated_booking as (
      update bookings
      set
        status = ${status},
        updated_at = now()
      where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
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
      (select count(*)::int from inserted_event) as event_count,
      (select customer_name from existing_booking limit 1) as customer_name,
      (select customer_email from existing_booking limit 1) as customer_email,
      (select customer_phone from existing_booking limit 1) as customer_phone,
      (select service from existing_booking limit 1) as service,
      (select city from existing_booking limit 1) as city,
      (select starts_at from existing_booking limit 1) as starts_at,
      (select ends_at from existing_booking limit 1) as ends_at
  `;

  const result = rows[0];

  if (!result?.booking_id) {
    throw new Error("Booking status update did not match a booking");
  }

  const changed = Number(result.updated_count ?? 0) > 0;

  return {
    changed,
    notification: changed
      ? {
          customerName: String(result.customer_name ?? "Kund"),
          customerEmail: String(result.customer_email ?? ""),
          customerPhone: String(result.customer_phone ?? ""),
          service: String(result.service ?? "Bokning"),
          city: String(result.city ?? ""),
          startsAt: new Date(String(result.starts_at)).toISOString(),
          endsAt: new Date(String(result.ends_at)).toISOString(),
        }
      : null,
  };
}
