import { NextResponse } from "next/server";

import { resolveAuthSecret } from "@/lib/auth-secret";
import { getSql } from "@/lib/db/server";
import {
  resolveBrevoApiKey,
  resolvePreviewEmailRecipient,
} from "@/lib/email-runtime-config";
import {
  isResolvedStripeTestMode,
  resolveStripePriceIdForPlan,
  resolveStripeWebhookSecret,
} from "@/lib/stripe-runtime-config";

const EXPECTED_PREVIEW_BRANCH_ID = "br-twilight-field-adg7752n";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse(null, { status: 404 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      {
        ready: false,
        environment: "preview",
        database: { configured: false, isolated: false },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  }

  let branchId: string | null = null;

  try {
    const rows = await sql`
      select current_setting('neon.branch_id', true) as branch_id
    `;
    const value = rows[0]?.branch_id;
    branchId = typeof value === "string" ? value : null;
  } catch {
    return NextResponse.json(
      {
        ready: false,
        environment: "preview",
        database: { configured: true, isolated: false },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex",
        },
      },
    );
  }

  const databaseIsolated = branchId === EXPECTED_PREVIEW_BRANCH_ID;
  const authConfigured = Boolean(resolveAuthSecret());
  const emailSandboxConfigured = Boolean(
    resolveBrevoApiKey() && resolvePreviewEmailRecipient(),
  );
  const stripeTestMode = isResolvedStripeTestMode();
  const stripeWebhookConfigured = Boolean(resolveStripeWebhookSecret());
  const stripePricesConfigured = Boolean(
    resolveStripePriceIdForPlan("starter")
      && resolveStripePriceIdForPlan("professional"),
  );

  const ready = Boolean(
    databaseIsolated
      && authConfigured
      && emailSandboxConfigured
      && stripeTestMode
      && stripeWebhookConfigured
      && stripePricesConfigured,
  );

  return NextResponse.json(
    {
      ready,
      environment: "preview",
      database: {
        configured: true,
        isolated: databaseIsolated,
      },
      auth: {
        configured: authConfigured,
      },
      email: {
        sandboxConfigured: emailSandboxConfigured,
        controlledRecipientConfigured: Boolean(resolvePreviewEmailRecipient()),
      },
      stripe: {
        testMode: stripeTestMode,
        webhookConfigured: stripeWebhookConfigured,
        pricesConfigured: stripePricesConfigured,
      },
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
