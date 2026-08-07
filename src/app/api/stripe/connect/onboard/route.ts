import { NextResponse } from "next/server";

import { getStripeClient } from "@/lib/stripe";
import { hasWorkspaceFeature } from "@/lib/workspace-entitlements";
import { canManageWorkspaceMembers, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { ensureWorkspaceStripeConnectAccount } from "@/lib/workspace-payments-db";

export const runtime = "nodejs";

function paymentsUrl(origin: string, locale: "sv" | "en", state?: string) {
  const url = new URL("/dashboard/installningar/betalningar", origin);
  if (locale === "en") url.searchParams.set("lang", "en");
  if (state) url.searchParams.set("connect", state);
  return url;
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const locale: "sv" | "en" = formData?.get("lang") === "en" ? "en" : "sv";
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceMembers(access)) {
    return NextResponse.redirect(paymentsUrl(requestUrl.origin, locale, "forbidden"), 303);
  }

  if (!(await hasWorkspaceFeature("payments"))) {
    return NextResponse.redirect(paymentsUrl(requestUrl.origin, locale, "locked"), 303);
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.redirect(paymentsUrl(requestUrl.origin, locale, "unconfigured"), 303);
  }

  try {
    const accountId = await ensureWorkspaceStripeConnectAccount(access.workspaceId);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: paymentsUrl(requestUrl.origin, locale, "refresh").toString(),
      return_url: paymentsUrl(requestUrl.origin, locale, "returned").toString(),
    });
    return NextResponse.redirect(accountLink.url, 303);
  } catch (error) {
    console.error("Failed to start Stripe Connect onboarding", error);
    return NextResponse.redirect(paymentsUrl(requestUrl.origin, locale, "error"), 303);
  }
}
