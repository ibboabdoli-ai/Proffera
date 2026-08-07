import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

import type { DashboardBookingDetail } from "@/lib/dashboard-db";
import { resolveBookingTimeZone } from "@/lib/public-booking-policy";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  resolveDatabaseUrl();

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
    const [bookingRows, settingsRows] = await Promise.all([
      sql`
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
      where b.workspace_id = ${access.workspaceId}
        and b.id = ${bookingId}
      limit 1
      `,
      sql`
        select time_zone
        from workspace_settings
        where workspace_id = ${access.workspaceId}
        limit 1
      `,
    ]);
    const timeZone = resolveBookingTimeZone(settingsRows[0]?.time_zone);

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
      where workspace_id = ${access.workspaceId}
        and booking_id = ${bookingId}
      order by created_at desc
      limit 20
    `;

    const customerId = toText(bookingRow.customer_id);

    return {
      booking: {
        id: toText(bookingRow.id),
        time: toWorkspaceDateText(bookingRow.starts_at, timeZone),
        title: toText(bookingRow.title, "Namnlös bokning"),
        customer: toText(bookingRow.customer_name, "Okänd kund"),
        status: toText(bookingRow.status, "requested"),
        city: toText(bookingRow.city, "Okänd ort"),
        service: toText(bookingRow.service, "Ej vald tjänst"),
        customerId,
        endsAt: toWorkspaceDateText(bookingRow.ends_at, timeZone),
        source: toText(bookingRow.source, "Okänd källa"),
        notes: toText(bookingRow.notes, "Ingen notering"),
        createdAt: toWorkspaceDateText(bookingRow.created_at, timeZone),
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
            createdAt: toWorkspaceDateText(bookingRow.customer_created_at, timeZone),
          }
        : null,
      events: eventRows.map((row) => ({
        id: toText(row.id),
        type: toText(row.event_type, "note"),
        title: toText(row.title, "Namnlös händelse"),
        description: toText(row.description, "Ingen beskrivning"),
        createdAt: toWorkspaceDateText(row.created_at, timeZone),
      })),
    };
  } catch (error) {
    console.error("Failed to read dashboard booking detail", error);
    return null;
  }
}
