import { NextResponse } from "next/server";

import { getMarketplaceGuestQuoteView } from "@/lib/marketplace-guest-quote-human-view";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const view = await getMarketplaceGuestQuoteView(token);
  if (!view) {
    return NextResponse.redirect(new URL(`/offert/svara/${encodeURIComponent(token)}`, request.url), 303);
  }

  const requestUrl = new URL(request.url);
  const english = requestUrl.searchParams.get("lang") === "en";
  const target = new URL(
    english
      ? `/en/companies/${encodeURIComponent(view.profileSlug)}`
      : `/foretag/listad/${encodeURIComponent(view.profileSlug)}`,
    request.url,
  );
  target.searchParams.set("from", "marketplace");
  return NextResponse.redirect(target, 303);
}
