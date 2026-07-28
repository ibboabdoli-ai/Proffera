import "server-only";

import { neon } from "@neondatabase/serverless";

import { parseLocalDateTime, stockholmDateToUtc, isValidStockholmLocalTime } from "@/lib/public-booking-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const LEGACY_WORKSPACE_ID = "__legacy_workspace_access_disabled__";

export class BookingRescheduleValidationError extends Error {
  constructor(public readonly code: "time" | "past" | "conflict" | "status") {
    super(code);
    this.name = "BookingRescheduleValidationError";
  }
}

export type BookingRescheduleResult = {
  changed: boolean;
  notification: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    service: string;
    city: string;
    previousStartsAt: string;
    startsAt: string;
    endsAt: string;
  } | null;
};

export async function rescheduleDashboardBooking(
  bookingId: string,
  localStartsAt: string,
): Promise<BookingRescheduleResult> {
  if (!connectionString) {
    throw new Error("Missing database connection for dashboard booking reschedule");
  }

  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("An owner or admin workspace membership is required for booking updates");
  }

  const localStart = parseLocalDateTime(localStartsAt);
  if (!localStart) throw new BookingRescheduleValidationError("time");

  const newStart = stockholmDateToUtc(localStart);
  if (!isValidStockholmLocalTime(localStart, newStart) || Number.isNaN(newStart.getTime())) {
    throw new BookingRescheduleValidationError("time");
  }
  if (newStart <= new Date()) throw new BookingRescheduleValidationError("past");

  const sql = neon(connectionString);
  const existingRows = await sql`
    select
      b.id,
      b.workspace_id,
      b.customer_id,
      b.status,
      b.service,
      b.city,
      b.starts_at,
      b.ends_at,
      c.name as customer_name,
      c.email as customer_email,
      c.phone as customer_phone
    from bookings b
    left join customers c on c.id = b.customer_id
    where b.workspace_id in (${access.workspaceId}, ${LEGACY_WORKSPACE_ID})
      and b.id = ${bookingId}
    limit 1
  `;

  const existing = existingRows[0];
  if (!existing) throw new Error("Booking reschedule did not match a booking");
  if (String(existing.status) === "cancelled" || String(existing.status) === "no_show") {
    throw new BookingRescheduleValidationError("status");
  }

  const oldStart = new Date(String(existing.starts_at));
  const oldEnd = new Date(String(existing.ends_at));
  const durationMs = oldEnd.getTime() - oldStart.getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new BookingRescheduleValidationError("time");
  }
  const newEnd = new Date(newStart.getTime() + durationMs);

  const conflicts = await sql`
    select id
    from bookings
    where workspace_id in (${access.workspaceId}, ${LEGACY_WORKSPACE_ID})
      and id <> ${bookingId}
      and status not in ('cancelled', 'no_show')
      and starts_at is not null
      and ends_at is not null
      and starts_at < ${newEnd.toISOString()}::timestamptz
      and ends_at > ${newStart.toISOString()}::timestamptz
    limit 1
  `;
  if (conflicts[0]) throw new BookingRescheduleValidationError("conflict");

  const changed = oldStart.getTime() !== newStart.getTime();
  if (!changed) return { changed: false, notification: null };

  await sql`
    update bookings
    set starts_at = ${newStart.toISOString()}::timestamptz,
        ends_at = ${newEnd.toISOString()}::timestamptz,
        updated_at = now()
    where workspace_id in (${access.workspaceId}, ${LEGACY_WORKSPACE_ID})
      and id = ${bookingId}
  `;

  await sql`
    insert into customer_events (
      workspace_id,
      customer_id,
      booking_id,
      event_type,
      title,
      description,
      metadata
    )
    values (
      ${String(existing.workspace_id)},
      ${existing.customer_id ? String(existing.customer_id) : null},
      ${bookingId},
      'booking_rescheduled',
      'Bokning ombokad',
      'Bokningens tid ändrades.',
      jsonb_build_object(
        'source', 'dashboard_manual',
        'previous_starts_at', ${oldStart.toISOString()},
        'previous_ends_at', ${oldEnd.toISOString()},
        'starts_at', ${newStart.toISOString()},
        'ends_at', ${newEnd.toISOString()}
      )
    )
  `;

  return {
    changed: true,
    notification: {
      customerName: String(existing.customer_name ?? "Kund"),
      customerEmail: String(existing.customer_email ?? ""),
      customerPhone: String(existing.customer_phone ?? ""),
      service: String(existing.service ?? "Bokning"),
      city: String(existing.city ?? ""),
      previousStartsAt: oldStart.toISOString(),
      startsAt: newStart.toISOString(),
      endsAt: newEnd.toISOString(),
    },
  };
}
