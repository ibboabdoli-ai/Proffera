import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const allowedBookingStatuses = ["requested", "confirmed", "completed", "cancelled"] as const;

export type DashboardBookingStatus = (typeof allowedBookingStatuses)[number];

function getSqlClient() {
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

export function isDashboardBookingStatus(value: string): value is DashboardBookingStatus {
  return allowedBookingStatuses.includes(value as DashboardBookingStatus);
}

export async function updateDashboardBookingStatus(bookingId: string, status: DashboardBookingStatus): Promise<void> {
  const sql = getSqlClient();

  if (!sql) {
    throw new Error("Missing database connection for dashboard booking status update");
  }

  const rows = await sql`
    update bookings
    set
      status = ${status},
      updated_at = now()
    where workspace_id = 'default'
      and id = ${bookingId}
    returning id
  `;

  if (!rows[0]?.id) {
    throw new Error("Booking status update did not match a booking");
  }
}
