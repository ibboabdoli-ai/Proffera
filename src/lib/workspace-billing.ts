import "server-only";

import type Stripe from "stripe";

import { getSql } from "@/lib/db/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkspaceBillingStatus = "pending" | "trialing" | "active" | "past_due" | "cancelled" | "paused";

export type WorkspaceBillingSummary = {
  databaseReady: boolean;
  status: WorkspaceBillingStatus | null;
  planKey: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function isBillingStatus(value: string): value is WorkspaceBillingStatus {
  return ["pending", "trialing", "active", "past_due", "cancelled", "paused"].includes(value);
}

function normalizeStripeStatus(status: Stripe.Subscription.Status): WorkspaceBillingStatus {
  if (status === "active" || status === "trialing" || status === "past_due" || status === "paused") return status;
  if (status === "canceled" || status === "incomplete_expired") return "cancelled";
  return "past_due";
}

function stripeId(value: string | { id: string } | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function getWorkspaceBillingSummary(workspaceId: string): Promise<WorkspaceBillingSummary> {
  const sql = getSql();

  if (!sql || !uuidPattern.test(workspaceId)) {
    return { databaseReady: false, status: null, planKey: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }

  try {
    const rows = await sql`
      select
        wbs.status,
        wbs.current_period_end,
        wbs.cancel_at_period_end,
        wp.plan_key
      from workspace_billing_subscriptions wbs
      left join workspace_plans wp on wp.id = wbs.workspace_plan_id
      where wbs.workspace_id = ${workspaceId}::uuid
      limit 1
    `;
    const row = rows[0];
    const status = asText(row?.status);

    return {
      databaseReady: true,
      status: isBillingStatus(status) ? status : null,
      planKey: asText(row?.plan_key) || null,
      currentPeriodEnd: row?.current_period_end ? new Date(String(row.current_period_end)).toISOString() : null,
      cancelAtPeriodEnd: row?.cancel_at_period_end === true,
    };
  } catch (error) {
    console.error("Failed to read workspace billing state", error);
    return { databaseReady: false, status: null, planKey: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }
}

export async function syncWorkspaceSubscription(subscription: Stripe.Subscription, eventCreated: number, expectedPriceId: string) {
  const sql = getSql();
  const workspaceId = subscription.metadata.workspace_id?.trim() ?? "";
  const subscriptionItem = subscription.items.data[0];
  const stripePriceId = subscriptionItem?.price.id ?? "";

  if (!sql || !uuidPattern.test(workspaceId) || stripePriceId !== expectedPriceId) {
    return { ok: false as const, code: "ignored" as const };
  }

  const status = normalizeStripeStatus(subscription.status);
  const modulesEnabled = status === "active" || status === "trialing";
  const customerId = stripeId(subscription.customer);
  const currentPeriodStart = subscriptionItem?.current_period_start
    ? new Date(subscriptionItem.current_period_start * 1000).toISOString()
    : null;
  const currentPeriodEnd = subscriptionItem?.current_period_end
    ? new Date(subscriptionItem.current_period_end * 1000).toISOString()
    : null;

  try {
    const rows = await sql`
      with permitted_event as (
        select 1
        where coalesce((
          select last_event_created
          from workspace_billing_subscriptions
          where workspace_id = ${workspaceId}::uuid
        ), 0) <= ${eventCreated}
      ),
      selected_workspace as (
        select id
        from workspaces
        where id = ${workspaceId}::uuid
      ),
      latest_plan as (
        select wp.id
        from workspace_plans wp
        join selected_workspace sw on sw.id = wp.workspace_id
        order by wp.created_at desc
        limit 1
      ),
      updated_plan as (
        update workspace_plans wp
        set
          plan_key = 'professional',
          status = ${status},
          current_period_start = ${currentPeriodStart},
          current_period_end = ${currentPeriodEnd},
          updated_at = now()
        from latest_plan lp, permitted_event pe
        where wp.id = lp.id
        returning wp.id
      ),
      inserted_plan as (
        insert into workspace_plans (
          id, workspace_id, plan_key, status, current_period_start, current_period_end, created_at, updated_at
        )
        select
          gen_random_uuid(), sw.id, 'professional', ${status}, ${currentPeriodStart}, ${currentPeriodEnd}, now(), now()
        from selected_workspace sw
        cross join permitted_event pe
        where not exists (select 1 from updated_plan)
        returning id
      ),
      selected_plan as (
        select id from updated_plan
        union all
        select id from inserted_plan
      ),
      billing_upsert as (
        insert into workspace_billing_subscriptions (
          id,
          workspace_id,
          workspace_plan_id,
          stripe_customer_id,
          stripe_subscription_id,
          stripe_price_id,
          status,
          cancel_at_period_end,
          current_period_start,
          current_period_end,
          last_event_created,
          created_at,
          updated_at
        )
        select
          gen_random_uuid(),
          sw.id,
          sp.id,
          ${customerId},
          ${subscription.id},
          ${stripePriceId},
          ${status},
          ${subscription.cancel_at_period_end},
          ${currentPeriodStart},
          ${currentPeriodEnd},
          ${eventCreated},
          now(),
          now()
        from selected_workspace sw
        cross join selected_plan sp
        on conflict (workspace_id)
        do update set
          workspace_plan_id = excluded.workspace_plan_id,
          stripe_customer_id = excluded.stripe_customer_id,
          stripe_subscription_id = excluded.stripe_subscription_id,
          stripe_price_id = excluded.stripe_price_id,
          status = excluded.status,
          cancel_at_period_end = excluded.cancel_at_period_end,
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          last_event_created = excluded.last_event_created,
          updated_at = now()
        returning workspace_id
      ),
      feature_values (feature_key, enabled) as (
        values
          ('booking_demo', ${modulesEnabled}),
          ('crm_customers', ${modulesEnabled}),
          ('lead_inbox', ${modulesEnabled})
      )
      insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
      select gen_random_uuid(), bu.workspace_id, fv.feature_key, fv.enabled, now(), now()
      from billing_upsert bu
      cross join feature_values fv
      on conflict (workspace_id, feature_key)
      do update set enabled = excluded.enabled, updated_at = now()
      returning workspace_id
    `;

    return rows.length > 0 ? { ok: true as const } : { ok: false as const, code: "stale" as const };
  } catch (error) {
    console.error("Failed to sync Stripe subscription", error);
    return { ok: false as const, code: "database" as const };
  }
}
