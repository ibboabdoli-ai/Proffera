import { neon } from "@neondatabase/serverless";

import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

export type WorkspaceBookingHour = {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
};

export const bookingWeekdays = [
  { value: 1, label: "Måndag" },
  { value: 2, label: "Tisdag" },
  { value: 3, label: "Onsdag" },
  { value: 4, label: "Torsdag" },
  { value: 5, label: "Fredag" },
  { value: 6, label: "Lördag" },
  { value: 0, label: "Söndag" },
] as const;

const defaultHours: WorkspaceBookingHour[] = bookingWeekdays.map(({ value }) => ({
  weekday: value,
  opensAt: "09:00",
  closesAt: "17:00",
  isClosed: value === 0 || value === 6,
}));

function getSqlClient() {
  return connectionString ? neon(connectionString) : null;
}

function toTime(value: unknown) {
  return String(value ?? "").slice(0, 5);
}

export async function getDashboardWorkspaceBookingHours() {
  const sql = getSqlClient();
  if (!sql) return { isConfigured: false, hours: defaultHours };

  const access = await getUserWorkspaceAccess();
  if (!access.ok) return { isConfigured: false, hours: defaultHours };

  try {
    const rows = await sql`
      select weekday, opens_at::text as opens_at, closes_at::text as closes_at, is_closed
      from workspace_booking_hours
      where workspace_id = ${access.workspaceId}
      order by weekday asc
    `;
    const saved = new Map(
      rows.map((row) => [
        Number(row.weekday),
        {
          weekday: Number(row.weekday),
          opensAt: toTime(row.opens_at),
          closesAt: toTime(row.closes_at),
          isClosed: Boolean(row.is_closed),
        },
      ]),
    );

    return {
      isConfigured: rows.length > 0,
      hours: bookingWeekdays.map(({ value }) => saved.get(value) ?? defaultHours.find((hour) => hour.weekday === value)!),
    };
  } catch (error) {
    console.error("Failed to read workspace booking hours", error);
    return { isConfigured: false, hours: defaultHours };
  }
}
