import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { mariaSwishQrPayload } from "@/lib/maria-deposit";
import { readMariaSwishQrEligibility } from "@/lib/maria-swish-qr-eligibility";

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
  try {
    const eligibility = await readMariaSwishQrEligibility(id);
    if (eligibility === "unavailable") return unavailable();
    if (eligibility === "ambiguous") {
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
