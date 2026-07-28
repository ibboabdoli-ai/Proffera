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
  type: "booking" | "block" | "time_off";
  title: string;
  customerName: string;
  service: string;
  city: string;
  status: string;
  startsAt: string;
  endsAt: string;
  source: string;
  staffId: string;
  staffName: string;
};

function text(value: unknown, fallback = "") {
  return value === null || value === undefined ? fallback : String(value);
}

const timeOffLabels: Record<string, string> = {
  leave: "Ledighet",
  sick: "Sjukfrånvaro",
  break: "Rast",
  other: "Ej tillgänglig",
};

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
    const [bookingRows, timeOffRows] = await Promise.all([
      sql`
        select
          b.id,
          b.title,
          b.status,
          b.city,
          b.service,
          b.starts_at,
          b.ends_at,
          b.source,
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
          and b.starts_at is not null
          and b.ends_at is not null
          and b.starts_at < ${rangeEnd.toISOString()}::timestamptz
          and b.ends_at > ${rangeStart.toISOString()}::timestamptz
        order by b.starts_at asc, b.created_at asc
        limit 2000
      `,
      sql`
        select
          t.id,
          t.staff_id,
          t.kind,
          t.reason,
          t.starts_at,
          t.ends_at,
          s.name as staff_name
        from workspace_staff_time_off t
        join workspace_staff s
          on s.id = t.staff_id
         and s.workspace_id = t.workspace_id
        where t.workspace_id = ${access.workspaceId}
          and t.starts_at < ${rangeEnd.toISOString()}::timestamptz
          and t.ends_at > ${rangeStart.toISOString()}::timestamptz
        order by t.starts_at asc
        limit 1000
      `,
    ]);

    const bookingEvents = bookingRows.map((row) => {
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
        staffId: text(row.staff_id),
        staffName: text(row.staff_name),
      } satisfies DashboardCalendarEvent;
    });

    const timeOffEvents = timeOffRows.map((row) => {
      const kind = text(row.kind, "other");
      const label = timeOffLabels[kind] ?? timeOffLabels.other;
      return {
        id: `time-off-${text(row.id)}`,
        type: "time_off",
        title: text(row.reason, label) || label,
        customerName: "",
        service: label,
        city: "",
        status: kind,
        startsAt: new Date(String(row.starts_at)).toISOString(),
        endsAt: new Date(String(row.ends_at)).toISOString(),
        source: "workspace_staff_time_off",
        staffId: text(row.staff_id),
        staffName: text(row.staff_name),
      } satisfies DashboardCalendarEvent;
    });

    return [...bookingEvents, ...timeOffEvents].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  } catch (error) {
    console.error("Failed to read dashboard calendar", error);
    return [];
  }
}
