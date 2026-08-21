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
    return new URL(origin).origin === new URL(request.url).origin;
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

function validIsoDate(value: string | null) {
  if (value === null) return true;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
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

  if (
    !priceKind
    || amount < 0
    || !confirmed
    || !validIsoDate(availableDate)
    || (priceKind !== "inspection_required" && amount <= 0)
  ) {
    return redirectToGuest(request, token, "invalid", locale);
  }

  let result;
  try {
    result = await submitMarketplaceGuestQuote({
      token,
      priceKind,
      amountMinor: priceKind === "inspection_required" ? 0 : amount,
      availableDate,
      companyNote,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("marketplace_profile_ineligible")) {
      return redirectToGuest(request, token, "closed", locale);
    }
    throw error;
  }

  if (!result.ok) return redirectToGuest(request, token, result.code, locale);
  return redirectToGuest(request, token, "sent", locale);
}
