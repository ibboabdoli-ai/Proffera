import "server-only";

import { neon } from "@neondatabase/serverless";

import type { DashboardBookingDetail } from "@/lib/dashboard-db";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const LEGACY_WORKSPACE_ID = "__legacy_workspace_access_disabled__";
const DASHBOARD_TIME_ZONE = "Europe/Stockholm";

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
    timeZone: DASHBOARD_TIME_ZONE,
  }).format(date);
}

export async function getDashboardBookingDetailInStockholm(bookingId: string): Promise<DashboardBookingDetail | null> {
  if (!connectionString) {
    return null;
  }

  const access = await getUserWorkspaceAccess();

  if (!access.ok) {
    throw new Error("A valid workspace membership is required for dashboard data");
  }

  const sql = neon(connectionString);

  try {
    const bookingRows = await sql`
      select
        b.id,
        b.customer_id,
        b.title,
        b.status,
        b.city,
        b.service,
        b.starts_at,
        b.ends_at,
        b.source,
        b.notes,
        b.created_at,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        c.company_name as customer_company_name,
        c.customer_type,
        c.city as customer_city,
        c.status as customer_status,
        c.source as customer_source,
        c.primary_service_slug as customer_service_slug,
        c.notes as customer_notes,
        c.created_at as customer_created_at
      from bookings b
      left join customers c on c.id = b.customer_id
      where b.workspace_id in (${access.workspaceId}, ${LEGACY_WORKSPACE_ID})
        and b.id = ${bookingId}
      limit 1
    `;

    const bookingRow = bookingRows[0];

    if (!bookingRow) {
      return null;
    }

    const eventRows = await sql`
      select
        id,
        event_type,
        title,
        description,
        created_at
      from customer_events
      where workspace_id in (${access.workspaceId}, ${LEGACY_WORKSPACE_ID})
        and booking_id = ${bookingId}
      order by case when workspace_id = ${access.workspaceId} then 0 else 1 end, created_at desc
      limit 20
    `;

    const customerId = toText(bookingRow.customer_id);

    return {
      booking: {
        id: toText(bookingRow.id),
        time: toStockholmDateText(bookingRow.starts_at),
        title: toText(bookingRow.title, "Namnlös bokning"),
        customer: toText(bookingRow.customer_name, "Okänd kund"),
        status: toText(bookingRow.status, "requested"),
        city: toText(bookingRow.city, "Okänd ort"),
        service: toText(bookingRow.service, "Ej vald tjänst"),
        customerId,
        endsAt: toStockholmDateText(bookingRow.ends_at),
        source: toText(bookingRow.source, "Okänd källa"),
        notes: toText(bookingRow.notes, "Ingen notering"),
        createdAt: toStockholmDateText(bookingRow.created_at),
      },
      customer: customerId
        ? {
            id: customerId,
            name: toText(bookingRow.customer_name, "Namnlös kund"),
            type: toText(bookingRow.customer_type) === "company" ? "Företag" : "Privatkund",
            city: toText(bookingRow.customer_city, "Okänd ort"),
            status: toText(bookingRow.customer_status, "prospect"),
            service: toText(bookingRow.customer_service_slug, "Ej valt"),
            notes: toText(bookingRow.customer_notes, "Ingen notering"),
            email: toText(bookingRow.customer_email, "Ingen e-post"),
            phone: toText(bookingRow.customer_phone, "Inget telefonnummer"),
            companyName: toText(bookingRow.customer_company_name, "Ej företag"),
            source: toText(bookingRow.customer_source, "Okänd källa"),
            createdAt: toStockholmDateText(bookingRow.customer_created_at),
          }
        : null,
      events: eventRows.map((row) => ({
        id: toText(row.id),
        type: toText(row.event_type, "note"),
        title: toText(row.title, "Namnlös händelse"),
        description: toText(row.description, "Ingen beskrivning"),
        createdAt: toStockholmDateText(row.created_at),
      })),
    };
  } catch (error) {
    console.error("Failed to read dashboard booking detail", error);
    return null;
  }
}
