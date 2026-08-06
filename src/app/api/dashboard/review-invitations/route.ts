import { NextResponse } from "next/server";
import { z } from "zod";

import { issueAndDeliverReviewInvitation } from "@/lib/verified-review-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  bookingId: z.string().uuid(),
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Select a valid completed booking." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await issueAndDeliverReviewInvitation(
    parsed.data.bookingId,
    request.url,
  );
  if (!result.ok) {
    const status =
      result.code === "access"
        ? 403
        : result.code === "already_used"
          ? 409
          : result.code === "database"
            ? 503
            : 400;
    const error =
      result.code === "access"
        ? "You do not have permission to create review invitations."
        : result.code === "already_used"
          ? "This booking already has a used review invitation."
          : result.code === "database"
            ? "The invitation could not be created right now."
            : "Only completed bookings in this workspace can receive a review invitation.";

    return NextResponse.json(
      { error },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      bookingId: result.bookingId,
      bookingTitle: result.bookingTitle,
      customerName: result.customerName,
      customerEmail: result.customerEmail,
      expiresAt: result.expiresAt,
      reviewUrl: result.reviewUrl,
      delivery: result.delivery,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
