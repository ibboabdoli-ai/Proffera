import "server-only";

import { getSql } from "@/lib/db/server";
import { mariaBookingNumber } from "@/lib/maria-deposit";
import { isMariaPreviewTestRecipient } from "@/lib/maria-preview-customer-safety";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MariaSwishQrEligibility = "eligible" | "unavailable" | "ambiguous";

/** Shared fail-closed eligibility for the Preview QR response and its dashboard image. */
export async function readMariaSwishQrEligibility(bookingId: string): Promise<MariaSwishQrEligibility> {
  if (process.env.VERCEL_ENV !== "preview"
    || process.env.PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED !== "true"
    || !uuid.test(bookingId)) return "unavailable";

  const approved = process.env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim().toLowerCase();
  if (!approved || !isMariaPreviewTestRecipient(approved)) return "unavailable";
  const sql = getSql();
  if (!sql) return "unavailable";

  const eligible = await sql`
    select b.id::text as id
    from bookings b
    join workspaces w on w.id::text=b.workspace_id
    join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
    where w.slug='makeup-by-maria'
      and w.status in ('active','trial')
      and b.id=${bookingId}::uuid
      and b.status in ('confirmed','completed')
      and b.source='public_booking'
      and lower(trim(c.email))=${approved}
    limit 1
  `;
  if (eligible.length !== 1) return "unavailable";

  // The public reference uses six UUID characters; never display a QR when
  // another Maria booking could be confused with this booking's reference.
  const duplicate = await sql`
    select count(*)::int as count
    from bookings b
    join workspaces w on w.id::text=b.workspace_id
    where w.slug='makeup-by-maria'
      and b.id<>${bookingId}::uuid
      and left(replace(b.id::text, '-', ''), 6)=${mariaBookingNumber(bookingId).slice(4).toLowerCase()}
  `;
  return Number(duplicate[0]?.count ?? 0) === 0 ? "eligible" : "ambiguous";
}
