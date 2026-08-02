import { NextResponse } from "next/server";

import { isCheckoutPlanKey } from "@/lib/billing-plans";
import { getSql } from "@/lib/db/server";
import {
  getStripeClient,
  getStripePriceIdForPlan,
  isStripeAdaptivePricingEnabled,
  isStripeTaxEnabled,
} from "@/lib/stripe";
import { DEFAULT_WORKSPACE_MARKET, resolveWorkspaceMarket } from "@/lib/workspace-market";
import { canManageWorkspaceMembers, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function settingsUrl(origin: string, status: "success" | "cancelled" | "error", locale: "sv" | "en") {
  const url = new URL("/dashboard/installningar", origin);
  if (status === "success" || status === "cancelled") url.searchParams.set("billing", status);
  if (status === "error") url.searchParams.set("billing", "error");
  if (locale === "en") url.searchParams.set("lang", "en");
  return url;
}

function isMissingStripeResource(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const stripeError = error as { code?: unknown; type?: unknown };
  return stripeError.code === "resource_missing" || stripeError.type === "StripeInvalidRequestError";
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = request.headers.get("origin");

  if (requestOrigin && requestOrigin !== requestUrl.origin) {
    return jsonError("Ogiltig begäran.", 403);
  }

  const contentType = request.headers.get("content-type") ?? "";
  const isNativeForm = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  let planKeyValue: unknown;
  let locale: "sv" | "en" = "sv";

  if (isNativeForm) {
    const formData = await request.formData().catch(() => null);
    planKeyValue = formData?.get("planKey");
    locale = formData?.get("lang") === "en" ? "en" : "sv";
  } else {
    const requestBody = await request.json().catch(() => null) as { planKey?: unknown; lang?: unknown } | null;
    planKeyValue = requestBody?.planKey;
    locale = requestBody?.lang === "en" ? "en" : "sv";
  }

  const fail = (message: string, status: number) => {
    if (isNativeForm) return NextResponse.redirect(settingsUrl(requestUrl.origin, "error", locale), 303);
    return jsonError(message, status);
  };

  const checkoutResponse = (url: string) => {
    if (isNativeForm) return NextResponse.redirect(url, 303);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  };

  const access = await getUserWorkspaceAccess();

  if (!access.ok || !canManageWorkspaceMembers(access)) {
    return fail("Endast arbetsytans Owner kan starta ett abonnemang.", 403);
  }

  if (!isCheckoutPlanKey(planKeyValue)) {
    return fail("Välj en tillgänglig plan.", 400);
  }

  const planKey = planKeyValue;
  const sql = getSql();
  const stripe = getStripeClient();
  const priceId = getStripePriceIdForPlan(planKey);

  if (!sql || !stripe || !priceId) {
    return fail("Betalningen är inte färdigkonfigurerad.", 503);
  }

  try {
    const [rows, settingsRows] = await Promise.all([
      sql`
      select
        stripe_customer_id,
        stripe_checkout_session_id,
        stripe_subscription_id,
        stripe_price_id,
        status
      from workspace_billing_subscriptions
      where workspace_id = ${access.workspaceId}::uuid
      limit 1
      `,
      sql`
        select billing_country_code, time_zone, billing_currency
        from workspace_settings
        where workspace_id = ${access.workspaceId}
        limit 1
      `,
    ]);
    const existing = rows[0];
    const configuredMarket = resolveWorkspaceMarket({
      countryCode: settingsRows[0]?.billing_country_code,
      timeZone: settingsRows[0]?.time_zone,
      billingCurrency: settingsRows[0]?.billing_currency,
    });
    const market = configuredMarket ?? DEFAULT_WORKSPACE_MARKET;
    const existingStatus = existing?.status ? String(existing.status) : "";

    const existingSessionId = existingStatus !== "cancelled" && existing?.stripe_checkout_session_id
      ? String(existing.stripe_checkout_session_id)
      : "";

    if (existingSessionId) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(existingSessionId);

        if (existingSession.status === "open" && existingSession.url) {
          const existingMarketMatches = existingSession.metadata?.billing_country_code === market.countryCode
            && existingSession.metadata?.billing_currency === market.billingCurrency
            && existingSession.metadata?.workspace_time_zone === market.timeZone;
          if (String(existing?.stripe_price_id ?? "") === priceId && existingMarketMatches) {
            return checkoutResponse(existingSession.url);
          }

          await stripe.checkout.sessions.expire(existingSessionId);
        }

        if (existingSession.status === "complete") {
          return fail("Betalningen är klar och väntar på bekräftelse från Stripe.", 409);
        }
      } catch (error) {
        if (!isMissingStripeResource(error)) throw error;
        console.warn("Ignoring stale Stripe Checkout session from another mode", existingSessionId);
      }
    }

    if (existing?.stripe_subscription_id && existingStatus !== "cancelled") {
      try {
        await stripe.subscriptions.retrieve(String(existing.stripe_subscription_id));
        return fail("Arbetsytan har redan ett abonnemang. Hantera betalningen via Stripe-portalen.", 409);
      } catch (error) {
        if (!isMissingStripeResource(error)) throw error;
        console.warn("Ignoring stale Stripe subscription from another mode", existing.stripe_subscription_id);
      }
    }

    let customerId = existing?.stripe_customer_id ? String(existing.stripe_customer_id) : undefined;
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) customerId = undefined;
      } catch (error) {
        if (!isMissingStripeResource(error)) throw error;
        console.warn("Ignoring stale Stripe customer from another mode", customerId);
        customerId = undefined;
      }
    }

    const successUrl = settingsUrl(requestUrl.origin, "success", locale).toString();
    const cancelUrl = settingsUrl(requestUrl.origin, "cancelled", locale).toString();
    const adaptivePricingEnabled = isStripeAdaptivePricingEnabled();
    const stripeTaxEnabled = isStripeTaxEnabled();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      billing_address_collection: "required",
      customer_update: customerId ? { address: "auto", name: "auto" } : undefined,
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: stripeTaxEnabled },
      adaptive_pricing: adaptivePricingEnabled ? { enabled: true } : undefined,
      client_reference_id: access.workspaceId,
      metadata: {
        workspace_id: access.workspaceId,
        workspace_owner_id: access.userId,
        plan_key: planKey,
        billing_country_code: market.countryCode,
        billing_currency: market.billingCurrency,
        workspace_time_zone: market.timeZone,
      },
      subscription_data: {
        metadata: {
          workspace_id: access.workspaceId,
          workspace_owner_id: access.userId,
          plan_key: planKey,
          billing_country_code: market.countryCode,
          billing_currency: market.billingCurrency,
          workspace_time_zone: market.timeZone,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!checkoutSession.url) {
      return fail("Stripe kunde inte skapa betalningssidan.", 502);
    }

    await sql`
      insert into workspace_billing_subscriptions (
        id, workspace_id, stripe_customer_id, stripe_checkout_session_id, stripe_price_id, status, created_at, updated_at
      )
      values (
        gen_random_uuid(),
        ${access.workspaceId}::uuid,
        ${customerId ?? null},
        ${checkoutSession.id},
        ${priceId},
        'pending',
        now(),
        now()
      )
      on conflict (workspace_id)
      do update set
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_checkout_session_id = excluded.stripe_checkout_session_id,
        stripe_subscription_id = null,
        stripe_price_id = excluded.stripe_price_id,
        status = 'pending',
        updated_at = now()
    `;

    return checkoutResponse(checkoutSession.url);
  } catch (error) {
    console.error("Failed to create Stripe Checkout session", error);
    return fail("Betalningssidan kunde inte öppnas. Försök igen.", 500);
  }
}
