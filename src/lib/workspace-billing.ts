import "server-only";

import type Stripe from "stripe";

import { type CheckoutPlanKey } from "@/lib/billing-plans";
import { getSql } from "@/lib/db/server";
import { syncWorkspaceAiChat } from "@/lib/service-ai-chat-bridge";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkspaceBillingStatus = "pending" | "trialing" | "active" | "past_due" | "cancelled" | "paused";

export type WorkspaceBillingSummary = {
  databaseReady: boolean;
  status: WorkspaceBillingStatus | null;
  planKey: string | null;
  hasSubscription: boolean;
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
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "past_due";
  if (status === "paused") return "paused";
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
    return { databaseReady: false, status: null, planKey: null, hasSubscription: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }

  try {
    const rows = await sql`
      select
        wbs.status,
        wbs.stripe_subscription_id,
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
      hasSubscription: Boolean(asText(row?.stripe_subscription_id)),
      currentPeriodEnd: row?.current_period_end ? new Date(String(row.current_period_end)).toISOString() : null,
      cancelAtPeriodEnd: row?.cancel_at_period_end === true,
    };
  } catch (error) {
    console.error("Failed to read workspace billing state", error);
    return { databaseReady: false, status: null, planKey: null, hasSubscription: false, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }
}

/**
 * Atomic, current-subscription-only entitlement revocation. A stale refund
 * must never alter the plan/features of a newly linked subscription.
 */
export async function syncCancelledWorkspaceSubscription(
  subscription: Stripe.Subscription,
  eventCreated: number,
  expectedPriceId: string,
) {
  const workspaceId = subscription.metadata.workspace_id?.trim() ?? "";
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? "";
  const customerId = stripeId(subscription.customer);
  if (!uuidPattern.test(workspaceId) || !customerId || !priceId ||
      priceId !== expectedPriceId || subscription.status !== "canceled" ||
      !Number.isSafeInteger(eventCreated)) {
    return { ok: false as const, code: "ignored" as const };
  }
  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" as const };
  const periodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000).toISOString() : null;
  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000).toISOString() : null;
  try {
    // One PostgreSQL statement: updating the bound billing row is the gate for
    // both dependent writes. Concurrent reassignment wins without leakage.
    const rows = await sql`
      with changed_billing as (
        update workspace_billing_subscriptions b
        set status = 'cancelled',
            cancel_at_period_end = false,
            stripe_price_id = ${priceId},
            current_period_start = coalesce(${periodStart}::timestamptz, b.current_period_start),
            current_period_end = coalesce(${periodEnd}::timestamptz, b.current_period_end),
            last_event_created = greatest(coalesce(b.last_event_created, 0), ${eventCreated}),
            updated_at = now()
        where b.workspace_id = ${workspaceId}::uuid
          and b.stripe_subscription_id = ${subscription.id}
          and b.stripe_customer_id = ${customerId}
        returning b.workspace_id, b.workspace_plan_id
      ),
      changed_plan as (
        update workspace_plans p
        set status = 'cancelled',
            current_period_start = coalesce(${periodStart}::timestamptz, p.current_period_start),
            current_period_end = coalesce(${periodEnd}::timestamptz, p.current_period_end),
            updated_at = now()
        from changed_billing b
        where p.id = b.workspace_plan_id
        returning p.id
      ),
      changed_flags as (
        insert into workspace_feature_flags (
          id, workspace_id, feature_key, enabled, created_at, updated_at
        )
        select gen_random_uuid(), b.workspace_id, f.feature_key, false, now(), now()
        from changed_billing b
        cross join (values
          ('booking_demo'), ('crm_customers'), ('lead_inbox'), ('ai_assistant')
        ) as f(feature_key)
        on conflict (workspace_id, feature_key)
        do update set enabled = false, updated_at = now()
        returning workspace_id
      )
      select
        (select count(*) from changed_billing)::int as billing_count,
        (select count(*) from changed_plan)::int as plan_count,
        (select count(*) from changed_flags)::int as flag_count
    `;
    if (Number(rows[0]?.billing_count ?? 0) === 0) {
      return { ok: false as const, code: "stale" as const };
    }
    if (Number(rows[0]?.plan_count ?? 0) !== 1 ||
        Number(rows[0]?.flag_count ?? 0) !== 4) {
      return { ok: false as const, code: "database" as const };
    }
    try {
      const aiChat = await syncWorkspaceAiChat({ workspaceId, enabled: false });
      if (!aiChat.ok) console.error("Cancelled AI Chat sync failed", { workspaceId, code: aiChat.code });
    } catch (error) {
      console.error("Cancelled AI Chat sync crashed", { workspaceId, error });
    }
    return { ok: true as const };
  } catch (error) {
    console.error("Failed to sync guarded Stripe cancellation", error);
    return { ok: false as const, code: "database" as const };
  }
}

export async function syncWorkspaceSubscription(
  subscription: Stripe.Subscription,
  eventCreated: number,
  planKey: CheckoutPlanKey,
  expectedPriceId: string,
) {
  const sql = getSql();
  const workspaceId = subscription.metadata.workspace_id?.trim() ?? "";
  const subscriptionItem = subscription.items.data[0];
  const stripePriceId = subscriptionItem?.price.id ?? "";
  const legacySubscription = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  if (!sql || !uuidPattern.test(workspaceId) || stripePriceId !== expectedPriceId) {
    return { ok: false as const, code: "ignored" as const };
  }

  if (subscription.status === "canceled") {
    return syncCancelledWorkspaceSubscription(subscription, eventCreated, expectedPriceId);
  }

  const status = normalizeStripeStatus(subscription.status);
  const modulesEnabled = status === "active" || status === "trialing";
  const customerCrmEnabled = modulesEnabled && planKey === "professional";
  const customerId = stripeId(subscription.customer);
  const currentPeriodStartTimestamp = subscriptionItem?.current_period_start ?? legacySubscription.current_period_start;
  const currentPeriodEndTimestamp = subscriptionItem?.current_period_end ?? legacySubscription.current_period_end;
  const currentPeriodStart = currentPeriodStartTimestamp
    ? new Date(currentPeriodStartTimestamp * 1000).toISOString()
    : null;
  const currentPeriodEnd = currentPeriodEndTimestamp
    ? new Date(currentPeriodEndTimestamp * 1000).toISOString()
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
          plan_key = ${planKey},
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
          gen_random_uuid(), sw.id, ${planKey}, ${status}, ${currentPeriodStart}, ${currentPeriodEnd}, now(), now()
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
          ('booking_demo', ${modulesEnabled}::boolean),
          ('crm_customers', ${customerCrmEnabled}::boolean),
          ('lead_inbox', ${modulesEnabled}::boolean),
          ('ai_assistant', ${customerCrmEnabled}::boolean)
      )
      insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
      select gen_random_uuid(), bu.workspace_id, fv.feature_key, fv.enabled, now(), now()
      from billing_upsert bu
      cross join feature_values fv
      on conflict (workspace_id, feature_key)
      do update set enabled = excluded.enabled, updated_at = now()
      returning workspace_id
    `;

    if (rows.length === 0) return { ok: false as const, code: "stale" as const };

    // AI Chat is deliberately a separate service. A temporary remote failure
    // must never make Stripe retry an already-persisted billing update.
    try {
      const aiChatResult = await syncWorkspaceAiChat({ workspaceId, enabled: customerCrmEnabled });
      if (!aiChatResult.ok) {
        console.error("Failed to synchronise AI Chat entitlement", {
          workspaceId,
          code: aiChatResult.code,
        });
      }
    } catch (error) {
      console.error("AI Chat entitlement synchronisation crashed", { workspaceId, error });
    }

    return { ok: true as const };
  } catch (error) {
    console.error("Failed to sync Stripe subscription", error);
    return { ok: false as const, code: "database" as const };
  }
}
