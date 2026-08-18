import { NextResponse } from "next/server";

import { resolveAuthSecret } from "@/lib/auth-secret";
import { getSql } from "@/lib/db/server";
import {
  getStripeClient,
  getStripePriceIdForPlan,
  getStripeWebhookSecret,
  isStripeTestMode,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const sql = getSql();
  const stripe = getStripeClient();
  const starterPriceId = getStripePriceIdForPlan("starter");
  const professionalPriceId = getStripePriceIdForPlan("professional");

  const result = {
    ok: false,
    environment: "preview",
    database: {
      configured: Boolean(sql),
      iborenWorkspaceFound: false,
      iborenOwnerMembershipFound: false,
    },
    auth: {
      previewSecretConfigured: Boolean(resolveAuthSecret()),
    },
    stripe: {
      testMode: isStripeTestMode(),
      clientConfigured: Boolean(stripe),
      webhookConfigured: Boolean(getStripeWebhookSecret()),
      starterConfigured: Boolean(starterPriceId),
      professionalConfigured: Boolean(professionalPriceId),
      starterReachable: false,
      professionalReachable: false,
      starterLivemode: null as boolean | null,
      professionalLivemode: null as boolean | null,
      starterCurrency: null as string | null,
      professionalCurrency: null as string | null,
      starterUnitAmount: null as number | null,
      professionalUnitAmount: null as number | null,
    },
  };

  if (sql) {
    const workspaceRows = await sql`
      select w.id
      from workspaces w
      where w.slug = 'iboren-preview-test'
      limit 1
    `;
    result.database.iborenWorkspaceFound = Boolean(workspaceRows[0]?.id);

    if (workspaceRows[0]?.id) {
      const membershipRows = await sql`
        select wm.id
        from workspace_memberships wm
        where wm.workspace_id = ${String(workspaceRows[0].id)}::uuid
          and wm.role = 'owner'
        limit 1
      `;
      result.database.iborenOwnerMembershipFound = Boolean(membershipRows[0]?.id);
    }
  }

  if (stripe && starterPriceId) {
    try {
      const price = await stripe.prices.retrieve(starterPriceId);
      result.stripe.starterReachable = true;
      result.stripe.starterLivemode = price.livemode;
      result.stripe.starterCurrency = price.currency;
      result.stripe.starterUnitAmount = price.unit_amount;
    } catch {
      // Keep the safe boolean result false; never expose Stripe error details or secrets.
    }
  }

  if (stripe && professionalPriceId) {
    try {
      const price = await stripe.prices.retrieve(professionalPriceId);
      result.stripe.professionalReachable = true;
      result.stripe.professionalLivemode = price.livemode;
      result.stripe.professionalCurrency = price.currency;
      result.stripe.professionalUnitAmount = price.unit_amount;
    } catch {
      // Keep the safe boolean result false; never expose Stripe error details or secrets.
    }
  }

  result.ok =
    result.database.configured &&
    result.database.iborenWorkspaceFound &&
    result.database.iborenOwnerMembershipFound &&
    result.auth.previewSecretConfigured &&
    result.stripe.testMode &&
    result.stripe.clientConfigured &&
    result.stripe.webhookConfigured &&
    result.stripe.starterReachable &&
    result.stripe.professionalReachable &&
    result.stripe.starterLivemode === false &&
    result.stripe.professionalLivemode === false;

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
