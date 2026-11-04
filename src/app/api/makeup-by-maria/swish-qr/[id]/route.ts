import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { getSql } from "@/lib/db/server";
import { mariaBookingNumber, mariaSwishQrPayload } from "@/lib/maria-deposit";
import { isMariaPreviewTestRecipient } from "@/lib/maria-preview-customer-safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const unavailable = () => new NextResponse(null, { status: 404, headers });

/**
 * Preview-only image for an approved, confirmed Maria booking.
 * The QR pre-fills Swish; it does not start or verify a bank transaction.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.VERCEL_ENV !== "preview"
    || process.env.PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED !== "true") {
    return unavailable();
  }
  const { id } = await params;
  if (!uuid.test(id)) return unavailable();
  const approved = process.env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim().toLowerCase();
  if (!approved || !isMariaPreviewTestRecipient(approved)) return unavailable();
  const sql = getSql();
  if (!sql) return unavailable();

  try {
    const eligible = await sql`
      select b.id::text as id
      from bookings b
      join workspaces w on w.id::text=b.workspace_id
      join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
      where w.slug='makeup-by-maria'
        and w.status in ('active','trial')
        and b.id=${id}::uuid
        and b.status in ('confirmed','completed')
        and b.source='public_booking'
        and lower(trim(c.email))=${approved}
      limit 1
    `;
    if (eligible.length !== 1) return unavailable();

    // The six-character format is shorter than a UUID: refuse an ambiguous
    // reference instead of showing a QR that might reconcile to two bookings.
    const duplicate = await sql`
      select count(*)::int as count
      from bookings b
      join workspaces w on w.id::text=b.workspace_id
      where w.slug='makeup-by-maria'
        and b.id<>${id}::uuid
        and left(replace(b.id::text, '-', ''), 6)=${mariaBookingNumber(id).slice(4).toLowerCase()}
    `;
    if (Number(duplicate[0]?.count ?? 0) !== 0) {
      return new NextResponse(null, { status: 409, headers });
    }

    const png = await QRCode.toBuffer(mariaSwishQrPayload(id), {
      type: "png", width: 380, margin: 3, errorCorrectionLevel: "M",
    });
    return new NextResponse(new Uint8Array(png), {
      headers: { ...headers, "Content-Type": "image/png" },
    });
  } catch (error) {
    console.error("Maria Preview Swish QR unavailable", error);
    return new NextResponse(null, { status: 503, headers });
  }
}
