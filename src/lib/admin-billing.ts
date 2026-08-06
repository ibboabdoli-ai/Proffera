import "server-only";

import { canAccessAdminBilling } from "@/lib/admin-billing-policy";
import { getSql } from "@/lib/db/server";
import { getPlatformAdmin } from "@/lib/platform-admin";

export { canAccessAdminBilling } from "@/lib/admin-billing-policy";

export type AdminBillingFilters = {
  query?: string;
  status?: string;
};

function safeText(value: string | undefined, maxLength: number) {
  const cleaned = value?.trim() ?? "";
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

function safeStatus(value: string | undefined) {
  const cleaned = value?.trim() ?? "";
  return ["trialing", "active", "past_due", "canceled", "none"].includes(cleaned)
    ? cleaned
    : null;
}

export async function listAdminBillingWorkspaces(filters: AdminBillingFilters = {}) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql || !canAccessAdminBilling(admin.role)) return null;

  const query = safeText(filters.query, 160);
  const searchPattern = query ? `%${query}%` : null;
  const status = safeStatus(filters.status);

  const workspaces = await sql`
    with billing_rows as (
      select
        w.id,
        w.slug,
        w.name as workspace_name,
        w.company_name as workspace_company_name,
        coalesce(ws.company_name, w.company_name, w.name) as company_name,
        p.id as workspace_plan_id,
        p.plan_key,
        case
          when wbs.stripe_subscription_id is not null then wbs.status
          else p.status
        end as subscription_status,
        case
          when wbs.stripe_subscription_id is not null then wbs.current_period_start
          else p.current_period_start
        end as current_period_start,
        case
          when wbs.stripe_subscription_id is not null then wbs.current_period_end
          else p.current_period_end
        end as current_period_end,
        (p.id is null) as missing_subscription,
        (wbs.stripe_subscription_id is not null) as stripe_bound,
        case
          when wbs.stripe_subscription_id is not null then 'stripe'
          else 'internal'
        end as billing_source,
        coalesce(wbs.cancel_at_period_end, false) as cancel_at_period_end,
        (
          p.status = 'trialing'
          and p.current_period_end is not null
          and wbs.stripe_subscription_id is null
          and (wbs.id is null or wbs.status in ('pending', 'trialing'))
        ) as trial_extension_allowed
      from workspaces w
      left join workspace_settings ws on ws.workspace_id = w.id::text
      left join lateral (
        select id, plan_key, status, current_period_start, current_period_end
        from workspace_plans
        where workspace_id = w.id
        order by created_at desc
        limit 1
      ) p on true
      left join workspace_billing_subscriptions wbs on wbs.workspace_id = w.id
    )
    select
      br.*,
      case
        when br.subscription_status = 'trialing' and br.current_period_end is not null
          then ceil(extract(epoch from (br.current_period_end - now())) / 86400.0)::int
        else null
      end as trial_days_remaining,
      (
        br.subscription_status = 'trialing'
        and br.current_period_end is not null
        and br.current_period_end < now()
      ) as trial_expired,
      (
        br.subscription_status = 'trialing'
        and br.current_period_end is not null
        and br.current_period_end >= now()
        and br.current_period_end <= now() + interval '7 days'
      ) as trial_ending_soon
    from billing_rows br
    where (
      ${searchPattern}::text is null
      or br.workspace_name ilike ${searchPattern}::text
      or br.slug ilike ${searchPattern}::text
      or coalesce(br.company_name, br.workspace_company_name, '') ilike ${searchPattern}::text
    )
      and (
        ${status}::text is null
        or (${status}::text = 'canceled' and br.subscription_status in ('canceled', 'cancelled'))
        or coalesce(br.subscription_status, 'none') = ${status}::text
      )
    order by
      case when br.subscription_status = 'past_due' then 0 else 1 end,
      case when br.subscription_status = 'trialing' and br.current_period_end <= now() + interval '7 days' then 0 else 1 end,
      br.company_name asc
  `;

  return { admin, workspaces };
}
