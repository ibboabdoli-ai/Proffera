import "server-only";

import { neon } from "@neondatabase/serverless";

import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

export type DashboardCalendarEvent = {
  id: string;
  type: "booking" | "block";
  title: string;
  customerName: string;
  service: string;
  city: string;
  status: string;
  startsAt: string;
  endsAt: string;
  source: string;
};

function text(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

export async function getDashboardCalendarEvents(): Promise<DashboardCalendarEvent[]> {
  if (!connectionString) return [];

  const access = await getUserWorkspaceAccess();
  if (!access.ok) throw new Error("A valid workspace membership is required for calendar data");

  const sql = neon(connectionString);
  const rangeStart = new Date();
  rangeStart.setUTCMonth(rangeStart.getUTCMonth() - 6);
  const rangeEnd = new Date();
  rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + 18);

  try {
    const rows = await sql`
      select
        b.id,
        b.title,
        b.status,
        b.city,
        b.service,
        b.starts_at,
        b.ends_at,
        b.source,
        c.name as customer_name
      from bookings b
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      where b.workspace_id = ${access.workspaceId}
        and b.starts_at is not null
        and b.ends_at is not null
        and b.starts_at < ${rangeEnd.toISOString()}::timestamptz
        and b.ends_at > ${rangeStart.toISOString()}::timestamptz
      order by b.starts_at asc, b.created_at asc
      limit 2000
    `;

    return rows.map((row) => {
      const source = text(row.source);
      const isBlock = source === "dashboard_availability_block" || source === "dashboard_availability_recurring_block";
      return {
        id: text(row.id),
        type: isBlock ? "block" : "booking",
        title: text(row.title, isBlock ? "Blockerad tid" : "Bokning"),
        customerName: text(row.customer_name, isBlock ? "" : "Okänd kund"),
        service: text(row.service, isBlock ? "Blockerad tid" : "Ej vald tjänst"),
        city: text(row.city),
        status: text(row.status, "requested"),
        startsAt: new Date(String(row.starts_at)).toISOString(),
        endsAt: new Date(String(row.ends_at)).toISOString(),
        source,
      } satisfies DashboardCalendarEvent;
    });
  } catch (error) {
    console.error("Failed to read dashboard calendar", error);
    return [];
  }
}
