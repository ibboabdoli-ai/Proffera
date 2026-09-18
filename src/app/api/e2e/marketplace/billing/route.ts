import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import {
  isPreviewMarketplaceE2eRuntime,
  resolveAuthorizedPreviewMarketplaceE2eRunId,
} from "@/lib/preview-marketplace-e2e";
import { getStripeClient, isStripeTestMode } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function unavailable() {
  return new NextResponse(null, { status: 404 });
}

function ownerEmail(runId: string) {
  return `provider-e2e-${runId}@owner.example.invalid`;
}

async function authorizedContext(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime() || !isStripeTestMode()) return null;
  const runId = await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers);
  if (!runId) return null;
  const sql = getSql();
  const stripe = getStripeClient();
  if (!sql || !stripe) return null;
  return { runId, sql, stripe };
}

async function workspaceForRun(
  sql: NonNullable<ReturnType<typeof getSql>>,
  runId: string,
) {
  const rows = await sql`
    select workspace.id::text as workspace_id
    from "user"
    join workspace_memberships membership on membership.user_id = "user".id
    join workspaces workspace on workspace.id = membership.workspace_id
    where lower("user".email) = ${ownerEmail(runId)}
      and membership.role in ('owner', 'admin')
      and workspace.status in ('active', 'trial')
    order by membership.created_at asc, workspace.id asc
    limit 1
  `;
  return String(rows[0]?.workspace_id ?? "");
}

export async function GET(request: Request) {
  const context = await authorizedContext(request);
  if (!context) return unavailable();
  const workspaceId = await workspaceForRun(context.sql, context.runId);
  if (!workspaceId) {
    return NextResponse.json({ ok: false, error: "workspace" }, { status: 409 });
  }

  const rows = await context.sql`
    select
      stripe_checkout_session_id,
      stripe_price_id,
      status
    from workspace_billing_subscriptions
    where workspace_id = ${workspaceId}::uuid
    limit 1
  `;
  const row = rows[0];

  return NextResponse.json({
    ok: true,
    billing: row
      ? {
          workspaceId,
          checkoutSessionId: String(row.stripe_checkout_session_id ?? ""),
          priceId: String(row.stripe_price_id ?? ""),
          status: String(row.status ?? ""),
        }
      : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const context = await authorizedContext(request);
  if (!context) return unavailable();
  const workspaceId = await workspaceForRun(context.sql, context.runId);
  if (!workspaceId) return NextResponse.json({ ok: true });

  const rows = await context.sql`
    select stripe_checkout_session_id
    from workspace_billing_subscriptions
    where workspace_id = ${workspaceId}::uuid
    limit 1
  `;
  const sessionId = String(rows[0]?.stripe_checkout_session_id ?? "");

  try {
    if (sessionId) {
      if (!sessionId.startsWith("cs_test_")) {
        return NextResponse.json({ ok: false, error: "non_test_session" }, { status: 409 });
      }
      const session = await context.stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "open") {
        await context.stripe.checkout.sessions.expire(sessionId);
      }
    }

    await context.sql`
      delete from workspace_billing_subscriptions
      where workspace_id = ${workspaceId}::uuid
    `;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Preview billing E2E cleanup failed", { error });
    return NextResponse.json({ ok: false, error: "billing_cleanup" }, { status: 500 });
  }
}
