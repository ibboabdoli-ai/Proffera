import "server-only";

import {
  canAccessAdminBilling,
  normalizeTrialExtensionReason,
  parseTrialExtensionDays,
} from "@/lib/admin-billing-policy";
import { getSql } from "@/lib/db/server";
import { getPlatformAdmin } from "@/lib/platform-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function extendInternalWorkspaceTrial(input: {
  workspaceId: string;
  workspacePlanId: string;
  expectedCurrentPeriodEnd: string;
  days: string;
  reason: string;
}) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql || !canAccessAdminBilling(admin.role)) {
    throw new Error("Billing admin access required");
  }

  const workspaceId = input.workspaceId.trim();
  const workspacePlanId = input.workspacePlanId.trim();
  if (!uuidPattern.test(workspaceId) || !uuidPattern.test(workspacePlanId)) {
    throw new Error("Invalid workspace reference");
  }

  const parsedDate = new Date(input.expectedCurrentPeriodEnd);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Invalid trial end date");
  }

  const expectedCurrentPeriodEnd = parsedDate.toISOString();
  const days = parseTrialExtensionDays(input.days);
  const reason = normalizeTrialExtensionReason(input.reason);

  const rows = await sql`
    with updated_plan as (
      update workspace_plans wp
      set
        current_period_end = wp.current_period_end + (${days}::int * interval '1 day'),
        updated_at = now()
      where wp.id = ${workspacePlanId}::uuid
        and wp.workspace_id = ${workspaceId}::uuid
        and wp.status = 'trialing'
        and wp.current_period_end is not null
        and wp.current_period_end = ${expectedCurrentPeriodEnd}::timestamptz
        and wp.id = (
          select latest.id
          from workspace_plans latest
          where latest.workspace_id = wp.workspace_id
          order by latest.created_at desc
          limit 1
        )
        and not exists (
          select 1
          from workspace_billing_subscriptions wbs
          where wbs.workspace_id = wp.workspace_id
            and wbs.stripe_subscription_id is not null
        )
        and not exists (
          select 1
          from workspace_billing_subscriptions wbs
          where wbs.workspace_id = wp.workspace_id
            and wbs.status not in ('pending', 'trialing')
        )
      returning
        wp.workspace_id,
        wp.plan_key,
        wp.status,
        wp.current_period_end - (${days}::int * interval '1 day') as previous_period_end,
        wp.current_period_end as new_period_end
    ),
    updated_internal_billing as (
      update workspace_billing_subscriptions wbs
      set
        current_period_end = up.new_period_end,
        updated_at = now()
      from updated_plan up
      where wbs.workspace_id = up.workspace_id
        and wbs.stripe_subscription_id is null
        and wbs.status in ('pending', 'trialing')
      returning wbs.workspace_id
    ),
    audit as (
      insert into admin_audit_logs (
        admin_user_id,
        workspace_id,
        action,
        reason,
        previous_value,
        new_value
      )
      select
        ${admin.userId},
        up.workspace_id,
        'billing.trial_extended',
        ${reason},
        jsonb_build_object(
          'plan_key', up.plan_key,
          'status', up.status,
          'current_period_end', up.previous_period_end,
          'billing_source', 'internal'
        ),
        jsonb_build_object(
          'plan_key', up.plan_key,
          'status', up.status,
          'current_period_end', up.new_period_end,
          'extension_days', ${days}::int,
          'billing_source', 'internal'
        )
      from updated_plan up
      returning id, workspace_id
    )
    select id, workspace_id
    from audit
  `;

  if (rows.length !== 1) {
    throw new Error("Trial extension was rejected because the subscription changed or is Stripe-managed");
  }

  return { workspaceId: String(rows[0].workspace_id) };
}

/**
 * Start Maria's first, internal 14-day trial in isolated Vercel Preview only.
 * This never creates a Stripe customer, checkout session or subscription.
 * A distinct try-lock serializes concurrent first-start attempts; if either
 * the plan or any billing record already exists, the statement writes nothing.
 */
export async function startMariaPreviewInternalTrial(input: {
  workspaceId: string;
  reason: string;
}) {
  if (process.env.VERCEL_ENV !== "preview") {
    throw new Error("Maria initial trial is Preview-only");
  }

  const admin = await getPlatformAdmin();
  if (admin?.role !== "super_admin") {
    throw new Error("Super admin access required");
  }

  const workspaceId = input.workspaceId.trim();
  if (!uuidPattern.test(workspaceId)) {
    throw new Error("Invalid workspace reference");
  }
  const reason = normalizeTrialExtensionReason(input.reason);
  const sql = getSql();
  if (!sql) throw new Error("Preview database unavailable");

  const rows = await sql`
    with trial_lock as materialized (
      select pg_try_advisory_xact_lock(714, hashtext('makeup-by-maria-initial-trial')) as acquired
    ),
    eligible_workspace as materialized (
      select w.id
      from workspaces w
      cross join trial_lock trial_lock_state
      where trial_lock_state.acquired = true
        and w.id = ${workspaceId}::uuid
        and w.slug = 'makeup-by-maria'
        and w.status in ('active', 'trial')
        and not exists (
          select 1 from workspace_plans p where p.workspace_id = w.id
        )
        and not exists (
          select 1 from workspace_billing_subscriptions s where s.workspace_id = w.id
        )
        and exists (
          select 1 from feature_catalog c
          where c.feature_key = 'online_booking' and c.is_active = true
        )
        and not exists (
          select 1 from workspace_feature_overrides o
          where o.workspace_id = w.id
            and o.feature_key = 'online_booking'
            and o.enabled = false
        )
    ),
    inserted_plan as (
      insert into workspace_plans (
        id, workspace_id, plan_key, status,
        current_period_start, current_period_end, created_at, updated_at
      )
      select
        gen_random_uuid(), e.id, 'starter', 'trialing',
        now(), now() + interval '14 days', now(), now()
      from eligible_workspace e
      returning workspace_id, plan_key, status, current_period_start, current_period_end
    ),
    enabled_feature as (
      insert into workspace_feature_flags (
        id, workspace_id, feature_key, enabled, created_at, updated_at
      )
      select gen_random_uuid(), p.workspace_id, 'online_booking', true, now(), now()
      from inserted_plan p
      where true
      on conflict (workspace_id, feature_key)
        do update set enabled = true, updated_at = now()
      returning workspace_id
    ),
    audit as (
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      )
      select
        ${admin.userId}, p.workspace_id, 'billing.maria_preview_trial_started',
        ${reason},
        jsonb_build_object('plan', null, 'billing_source', 'internal'),
        jsonb_build_object(
          'plan_key', p.plan_key,
          'status', p.status,
          'current_period_start', p.current_period_start,
          'current_period_end', p.current_period_end,
          'trial_days', 14,
          'billing_source', 'internal',
          'preview_only', true
        )
      from inserted_plan p
      join enabled_feature f on f.workspace_id = p.workspace_id
      returning workspace_id
    )
    select workspace_id from audit
  `;

  if (rows.length !== 1) {
    throw new Error("Trial not started: workspace, billing, or access state changed");
  }

  return { workspaceId: String(rows[0].workspace_id) };
}
