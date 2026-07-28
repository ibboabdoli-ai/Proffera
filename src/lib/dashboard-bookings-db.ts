import "server-only";

import { neon } from "@neondatabase/serverless";

import type { DashboardBooking } from "@/lib/dashboard-db";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const LEGACY_WORKSPACE_ID = "__legacy_workspace_access_disabled__";

function toText(value: unknown, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function toStockholmDateText(value: unknown) {
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
    timeZone: "Europe/Stockholm",
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
    const rows = await sql`
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
      where b.workspace_id in (${access.workspaceId}, ${LEGACY_WORKSPACE_ID})
      order by case when b.workspace_id = ${access.workspaceId} then 0 else 1 end, b.starts_at asc nulls last, b.created_at desc
      limit 20
    `;

    return rows.map((row) => ({
      id: toText(row.id),
      time: toStockholmDateText(row.starts_at),
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
