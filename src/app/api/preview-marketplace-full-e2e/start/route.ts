import { NextRequest, NextResponse } from "next/server";

import { sendMarketplaceGuestQuoteInvitation } from "@/lib/marketplace-guest-quote";

export const dynamic = "force-dynamic";

const QUOTE_REQUEST_ID = "a1c49f58-dc6c-4cc0-a531-8495a2d00df2";
const PROFILE_ID = "967f0899-6692-4dd5-9189-2b632a1a858c";
const ADMIN_USER_ID = "LM8m57feAUevI9zes9Jt985j9KgwSmvf";
const CONTROLLED_RECIPIENT = "ibbo.abdoli@elektroautomatik.se";

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const configuredRecipient = process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT?.trim().toLowerCase();
  if (configuredRecipient !== CONTROLLED_RECIPIENT) {
    return NextResponse.json({ ok: false, code: "recipient_guard" }, { status: 409 });
  }

  const result = await sendMarketplaceGuestQuoteInvitation({
    quoteRequestId: QUOTE_REQUEST_ID,
    profileId: PROFILE_ID,
    recipientEmail: CONTROLLED_RECIPIENT,
    adminUserId: ADMIN_USER_ID,
    baseUrl: request.nextUrl.origin,
    wave: 1,
    matchScore: 100,
    matchReasons: ["preview_full_e2e"],
  });

  return NextResponse.json({
    ok: result.ok,
    code: "code" in result ? result.code : null,
    invitationId: "invitationId" in result ? result.invitationId : null,
    providerMessageIdPresent: Boolean("providerMessageId" in result && result.providerMessageId),
  }, { status: result.ok ? 200 : 409 });
}
