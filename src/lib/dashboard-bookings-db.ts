import "server-only";

import { neon } from "@neondatabase/serverless";

import type { DashboardBooking } from "@/lib/dashboard-db";
import { resolveBookingTimeZone } from "@/lib/public-booking-policy";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

function toText(value: unknown, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function toWorkspaceDateText(value: unknown, timeZone: ReturnType<typeof resolveBookingTimeZone>) {
  if (!value) {
    return "Ej bokad";
  }

  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "Ej bokad";
  }

  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export async function getDashboardBookingsInStockholm(): Promise<DashboardBooking[]> {
  if (!connectionString) {
    return [];
  }

  const access = await getUserWorkspaceAccess();

  if (!access.ok) {
    throw new Error("A valid workspace membership is required for dashboard data");
  }

  const sql = neon(connectionString);

  try {
    const [rows, settingsRows] = await Promise.all([
      sql`
      select
        b.id,
        b.title,
        b.status,
        b.city,
        b.service,
        b.starts_at,
        c.name as customer_name
      from bookings b
      left join customers c on c.id = b.customer_id
      where b.workspace_id = ${access.workspaceId}
      order by b.starts_at asc nulls last, b.created_at desc
      limit 20
      `,
      sql`
        select time_zone
        from workspace_settings
        where workspace_id = ${access.workspaceId}
        limit 1
      `,
    ]);
    const timeZone = resolveBookingTimeZone(settingsRows[0]?.time_zone);

    return rows.map((row) => ({
      id: toText(row.id),
      time: toWorkspaceDateText(row.starts_at, timeZone),
      title: toText(row.title, "Namnlös bokning"),
      customer: toText(row.customer_name, "Okänd kund"),
      status: toText(row.status, "requested"),
      city: toText(row.city, "Okänd ort"),
      service: toText(row.service, "Ej vald tjänst"),
    }));
  } catch (error) {
    console.error("Failed to read dashboard bookings", error);
    return [];
  }
}
