import { NextResponse } from "next/server";

import { getAdminForArea } from "@/lib/admin-authorization";
import { sendMarketplaceGuestQuoteInvitation } from "@/lib/marketplace-guest-quote";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function uuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(text) ? text : "";
}

function safeReasons(value: FormDataEntryValue | null) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function invitationErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("marketplace_wave_limit")) return "wave_limit";
  if (message.includes("marketplace_invalid_wave")) return "invalid_wave";
  return "failed";
}

export async function POST(request: Request) {
  const admin = await getAdminForArea("quote_admin");
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });

  const form = await request.formData();
  const quoteRequestId = uuid(form.get("quoteRequestId"));
  const profileId = uuid(form.get("profileId"));
  const recipientEmail = String(form.get("recipientEmail") ?? "").trim();
  const confirmedBusinessContact = String(form.get("confirmBusinessContact") ?? "") === "yes";
  const wave = Number(form.get("wave") ?? 1);
  const matchScore = Number(form.get("matchScore") ?? 0);
  const matchReasons = safeReasons(form.get("matchReasons"));

  if (!quoteRequestId || !profileId || !recipientEmail || !confirmedBusinessContact) {
    return NextResponse.redirect(new URL("/admin/marketplace?invite=invalid", request.url), 303);
  }
  if (!Number.isInteger(wave) || (wave !== 1 && wave !== 2)) {
    return NextResponse.redirect(new URL("/admin/marketplace?invite=invalid_wave", request.url), 303);
  }

  try {
    const result = await sendMarketplaceGuestQuoteInvitation({
      quoteRequestId,
      profileId,
      recipientEmail,
      adminUserId: admin.userId,
      baseUrl: new URL(request.url).origin,
      wave,
      matchScore,
      matchReasons,
    });

    if (!result.ok) {
      return NextResponse.redirect(
        new URL(`/admin/marketplace?invite=${encodeURIComponent(result.code)}`, request.url),
        303,
      );
    }

    return NextResponse.redirect(new URL("/admin/marketplace?invite=sent", request.url), 303);
  } catch (error) {
    const code = invitationErrorCode(error);
    console.error("Marketplace guest invitation failed before delivery", {
      quoteRequestId,
      profileId,
      code,
    });
    return NextResponse.redirect(
      new URL(`/admin/marketplace?invite=${encodeURIComponent(code)}`, request.url),
      303,
    );
  }
}
