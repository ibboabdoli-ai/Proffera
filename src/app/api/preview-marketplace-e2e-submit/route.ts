import { NextResponse } from "next/server";

import {
  getMarketplaceGuestQuoteView,
  submitMarketplaceGuestQuote,
} from "@/lib/marketplace-guest-quote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const confirmed = url.searchParams.get("confirm") === "preview-e2e";
  if (!token || !confirmed) {
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 400 });
  }

  const view = await getMarketplaceGuestQuoteView(token);
  if (
    !view
    || !view.quoteReferenceId.startsWith("E2E-")
    || view.profileSlug !== "proffera-preview-e2e-ab"
    || view.companyName !== "Proffera Preview E2E AB"
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const result = await submitMarketplaceGuestQuote({
    token,
    priceKind: "fixed",
    amountMinor: 180_000,
    availableDate: "2026-08-29",
    companyNote: "Synthetic Preview E2E offer. No real company or customer data.",
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : 409,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
