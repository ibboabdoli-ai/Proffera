import "server-only";

import { getSql } from "@/lib/db/server";
import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";
import { mariaBookingNumber } from "@/lib/maria-deposit";
import { isMariaPreviewTestRecipient } from "@/lib/maria-preview-customer-safety";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MariaSwishQrEligibility = "eligible" | "unavailable" | "ambiguous";

/** Shared fail-closed eligibility for Maria QR and its dashboard image. */
export async function readMariaSwishQrEligibility(bookingId: string, expectedWorkspaceId?: string): Promise<MariaSwishQrEligibility> {
  if (!uuid.test(bookingId)) return "unavailable";
  const preview = process.env.VERCEL_ENV === "preview";
  const production = process.env.VERCEL_ENV === "production";
  if (!preview && !production) return "unavailable";
  // Existing unpaid confirmed bookings retain their payment link if intake is
  // temporarily paused. Preview still requires the isolated QA gate.
  const readiness = preview ? await getMariaBookingReadiness() : null;
  const previewWorkspaceId = readiness?.enabled ? readiness.workspaceId : null;
  if ((preview && !previewWorkspaceId)
    || (expectedWorkspaceId && !uuid.test(expectedWorkspaceId))
    || (preview && expectedWorkspaceId && previewWorkspaceId !== expectedWorkspaceId)) {
    return "unavailable";
  }
  const scopedWorkspaceId = expectedWorkspaceId ?? previewWorkspaceId;
  const approved = preview
    ? process.env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim().toLowerCase()
    : null;
  if (preview && (!approved || !isMariaPreviewTestRecipient(approved))) return "unavailable";
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
      and (${!preview}::boolean or lower(trim(c.email))=${approved ?? ""})
      and (${!scopedWorkspaceId}::boolean or b.workspace_id=${scopedWorkspaceId ?? ""})
      and coalesce((
        select e.metadata->>'state' from customer_events e
        where e.workspace_id=b.workspace_id and e.booking_id=b.id
          and e.event_type='note'
          and e.metadata->>'source'='maria_swish_manual_deposit_v1'
          and e.metadata->>'state' in ('paid','unverified')
        order by e.created_at desc, e.id desc limit 1
      ), 'unverified') <> 'paid'
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
