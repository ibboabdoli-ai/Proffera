import "server-only";

import { getSql } from "@/lib/db/server";
import { mariaBookingNumber } from "@/lib/maria-deposit";

/**
 * Resolve the immutable Swish reference for a verified Maria booking.
 * A booking from before migration 0076 keeps its existing long reference,
 * so a customer never sees a different message than an earlier email.
 * Fail closed if the reference storage itself cannot be checked.
 */
export async function readMariaBookingReference(bookingId: string): Promise<string> {
  // Validate before embedding the identifier in a database query.
  mariaBookingNumber(bookingId);
  const sql = getSql();
  if (!sql) throw new Error("MARIA_REFERENCE_DATABASE_UNAVAILABLE");

  const rows = await sql`
    select ref.reference
    from bookings b
    join workspaces w on w.id::text=b.workspace_id
    left join maria_booking_references ref on ref.booking_id=b.id
    where b.id=${bookingId}::uuid
      and w.slug='makeup-by-maria' and w.status in ('active','trial')
    limit 1
  `;
  if (rows.length !== 1) throw new Error("MARIA_REFERENCE_BOOKING_NOT_FOUND");
  const stored = rows[0]?.reference;
  return mariaBookingNumber(bookingId, typeof stored === "string" ? stored : undefined);
}
