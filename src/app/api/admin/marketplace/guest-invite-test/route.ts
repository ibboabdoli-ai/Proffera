import { NextResponse } from "next/server";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { sendMarketplaceGuestQuoteTestInvitation } from "@/lib/marketplace-guest-quote-test";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function redirectToTestResult(request: Request, result: string) {
  const target = new URL("/admin/marketplace", request.url);
  target.searchParams.set("test", result);
  return NextResponse.redirect(target, 303);
}

export async function POST(request: Request) {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });

  const form = await request.formData();
  const recipientEmail = String(form.get("recipientEmail") ?? "").trim();
  const confirmed = String(form.get("confirmControlledTestRecipient") ?? "") === "yes";
  if (!recipientEmail || !confirmed) return redirectToTestResult(request, "invalid");

  const result = await sendMarketplaceGuestQuoteTestInvitation({
    adminUserId: admin.userId,
    recipientEmail,
    baseUrl: new URL(request.url).origin,
  });
  return redirectToTestResult(request, result.ok ? "sent" : result.code);
}
