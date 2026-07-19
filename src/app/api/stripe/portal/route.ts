import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import { getStripeClient } from "@/lib/stripe";
import { canManageWorkspaceMembers, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = request.headers.get("origin");

  if (requestOrigin && requestOrigin !== requestUrl.origin) {
    return jsonError("Ogiltig begäran.", 403);
  }

  const access = await getUserWorkspaceAccess();

  if (!access.ok || !canManageWorkspaceMembers(access)) {
    return jsonError("Endast arbetsytans Owner kan hantera abonnemanget.", 403);
  }

  const sql = getSql();
  const stripe = getStripeClient();

  if (!sql || !stripe) {
    return jsonError("Betalningsportalen är inte färdigkonfigurerad.", 503);
  }

  try {
    const rows = await sql`
      select stripe_customer_id
      from workspace_billing_subscriptions
      where workspace_id = ${access.workspaceId}::uuid
      limit 1
    `;
    const customerId = rows[0]?.stripe_customer_id ? String(rows[0].stripe_customer_id) : "";

    if (!customerId) {
      return jsonError("Ingen Stripe-kund är kopplad till arbetsytan.", 409);
    }

    const returnUrl = `${requestUrl.origin}/dashboard/installningar?billing=portal`;
    const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
    let configuration = configurations.data.find(
      (item) => item.metadata?.proffera_portal === "subscription_management",
    );

    if (!configuration) {
      configuration = await stripe.billingPortal.configurations.create({
        name: "Proffera subscription management",
        default_return_url: returnUrl,
        business_profile: {
          headline: "Hantera ditt Proffera-abonnemang",
          privacy_policy_url: `${requestUrl.origin}/integritetspolicy`,
          terms_of_service_url: `${requestUrl.origin}/villkor`,
        },
        features: {
          customer_update: { enabled: false },
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_cancel: {
            enabled: true,
            mode: "at_period_end",
            proration_behavior: "none",
            cancellation_reason: {
              enabled: true,
              options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
            },
          },
          subscription_update: { enabled: false },
        },
        metadata: { proffera_portal: "subscription_management" },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: configuration.id,
      locale: "sv",
      return_url: returnUrl,
    });

    return NextResponse.json(
      { url: session.url },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to create Stripe customer portal session", error);
    return jsonError("Betalningsportalen kunde inte öppnas. Försök igen.", 500);
  }
}
