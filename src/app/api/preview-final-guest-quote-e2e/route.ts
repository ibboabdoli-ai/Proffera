import { NextResponse } from "next/server";

import { sendMarketplaceGuestQuoteInvitation } from "@/lib/marketplace-guest-quote";

export const dynamic = "force-dynamic";

const QUOTE_ID = "be0b24bb-2f28-4508-8464-80a39e75cef4";
const PROFILE_ID = "3ce9addf-3bd4-498c-abb0-02e5e944ed6c";
const ADMIN_USER_ID = "LM8m57feAUevI9zes9Jt985j9KgwSmvf";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false, code: "preview_only" }, { status: 404 });
  }
  if (!process.env.PROFFERA_PREVIEW_EMAIL_RECIPIENT?.trim()) {
    return NextResponse.json({ ok: false, code: "preview_recipient_missing" }, { status: 503 });
  }

  const baseUrl = new URL(request.url).origin;
  const result = await sendMarketplaceGuestQuoteInvitation({
    quoteRequestId: QUOTE_ID,
    profileId: PROFILE_ID,
    recipientEmail: "final-e2e@proffera-test-company.se",
    adminUserId: ADMIN_USER_ID,
    baseUrl,
    wave: 1,
    matchScore: 100,
    matchReasons: ["preview_final_e2e"],
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
