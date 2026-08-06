import "server-only";

import { getSql } from "@/lib/db/server";
import { getPlatformAdmin, type PlatformAdminRole } from "@/lib/platform-admin";

export const BILLING_ADMIN_ROLES: PlatformAdminRole[] = ["super_admin", "billing_admin"];

export type AdminBillingFilters = {
  query?: string;
  status?: string;
};

export function canAccessAdminBilling(role: PlatformAdminRole) {
  return BILLING_ADMIN_ROLES.includes(role);
}

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
    select
      w.id,
      w.slug,
      coalesce(ws.company_name, w.company_name, w.name) as company_name,
      p.plan_key,
      p.status as subscription_status,
      p.current_period_start,
      p.current_period_end,
      (p.id is null) as missing_subscription,
      case
        when p.status = 'trialing' and p.current_period_end is not null
          then ceil(extract(epoch from (p.current_period_end - now())) / 86400.0)::int
        else null
      end as trial_days_remaining,
      (p.status = 'trialing' and p.current_period_end is not null and p.current_period_end < now()) as trial_expired,
      (p.status = 'trialing' and p.current_period_end is not null and p.current_period_end >= now() and p.current_period_end <= now() + interval '7 days') as trial_ending_soon
    from workspaces w
    left join workspace_settings ws on ws.workspace_id = w.id::text
    left join lateral (
      select id, plan_key, status, current_period_start, current_period_end
      from workspace_plans
      where workspace_id = w.id
      order by created_at desc
      limit 1
    ) p on true
    where (
      ${searchPattern}::text is null
      or w.name ilike ${searchPattern}::text
      or w.slug ilike ${searchPattern}::text
      or coalesce(ws.company_name, w.company_name, '') ilike ${searchPattern}::text
    )
      and (
        ${status}::text is null
        or coalesce(p.status, 'none') = ${status}::text
      )
    order by
      case when p.status = 'past_due' then 0 else 1 end,
      case when p.status = 'trialing' and p.current_period_end <= now() + interval '7 days' then 0 else 1 end,
      coalesce(ws.company_name, w.company_name, w.name) asc
  `;

  return { admin, workspaces };
}
