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
