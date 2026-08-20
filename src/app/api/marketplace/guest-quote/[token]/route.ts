import { NextResponse } from "next/server";

import { hashMarketplaceGuestToken, submitMarketplaceGuestQuote } from "@/lib/marketplace-guest-quote";
import { allowPublicSubmission } from "@/lib/public-form-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function amountMinor(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (!normalized) return 0;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10_000_000) return -1;
  return Math.round(parsed * 100);
}

function redirectToGuest(request: Request, token: string, status: string, locale: "sv" | "en") {
  const target = new URL(`/offert/svara/${encodeURIComponent(token)}`, request.url);
  target.searchParams.set("status", status);
  if (locale === "en") target.searchParams.set("lang", "en");
  return NextResponse.redirect(target, 303);
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });

  const form = await request.formData();
  const locale = String(form.get("lang") ?? "") === "en" ? "en" as const : "sv" as const;

  const allowed = await allowPublicSubmission({
    scope: "marketplace-guest-quote",
    requestHeaders: request.headers,
    identity: hashMarketplaceGuestToken(token),
    maxAttempts: 5,
    windowSeconds: 30 * 60,
  });
  if (!allowed) return redirectToGuest(request, token, "rate_limited", locale);

  const priceKindRaw = String(form.get("priceKind") ?? "");
  const priceKind = priceKindRaw === "fixed" || priceKindRaw === "estimate" || priceKindRaw === "inspection_required"
    ? priceKindRaw
    : null;
  const amount = amountMinor(form.get("amountSek"));
  const availableDate = String(form.get("availableDate") ?? "").trim() || null;
  const companyNote = String(form.get("companyNote") ?? "").trim().slice(0, 4000);
  const confirmed = String(form.get("confirmAuthority") ?? "") === "yes";

  if (!priceKind || amount < 0 || !confirmed || (priceKind !== "inspection_required" && amount <= 0)) {
    return redirectToGuest(request, token, "invalid", locale);
  }

  const result = await submitMarketplaceGuestQuote({
    token,
    priceKind,
    amountMinor: priceKind === "inspection_required" ? 0 : amount,
    availableDate,
    companyNote,
  });

  if (!result.ok) return redirectToGuest(request, token, result.code, locale);
  return redirectToGuest(request, token, "sent", locale);
}
