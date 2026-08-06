import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildVerifiedReviewUrl,
  deliverVerifiedReviewInvitation,
} from "@/lib/verified-review-email-delivery";
import { issueReviewInvitation } from "@/lib/verified-review-invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  bookingId: z.string().uuid(),
  delivery: z.enum(["link", "email"]).optional().default("link"),
});

function invitationError(code: string) {
  const status =
    code === "access"
      ? 403
      : code === "already_used"
        ? 409
        : code === "database"
          ? 503
          : 400;
  const error =
    code === "access"
      ? "You do not have permission to create review invitations."
      : code === "already_used"
        ? "This booking already has a used review invitation."
        : code === "database"
          ? "The invitation could not be created right now."
          : "Only completed bookings in this workspace can receive a review invitation.";

  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

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

  if (parsed.data.delivery === "email") {
    const delivery = await deliverVerifiedReviewInvitation(parsed.data.bookingId);
    const invitation = delivery.invitation;

    if (!invitation) return invitationError(delivery.code);

    return NextResponse.json(
      {
        bookingId: invitation.bookingId,
        bookingTitle: invitation.bookingTitle,
        customerName: invitation.customerName,
        customerEmail: invitation.customerEmail,
        expiresAt: invitation.expiresAt,
        reviewUrl: delivery.reviewUrl,
        emailSent: delivery.ok,
        emailError: delivery.ok ? null : delivery.emailError,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await issueReviewInvitation(parsed.data.bookingId);
  if (!result.ok) return invitationError(result.code);

  return NextResponse.json(
    {
      bookingId: result.bookingId,
      bookingTitle: result.bookingTitle,
      customerName: result.customerName,
      customerEmail: result.customerEmail,
      expiresAt: result.expiresAt,
      reviewUrl: buildVerifiedReviewUrl(result.token),
      emailSent: null,
      emailError: null,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
