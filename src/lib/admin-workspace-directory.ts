import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";

export type AdminWorkspaceDirectoryFilters = {
  query?: string;
  planStatus?: string;
  attentionOnly?: boolean;
};

function safeText(value: string | undefined, maxLength: number) {
  const cleaned = value?.trim() ?? "";
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

export async function listAdminWorkspaceDirectory(filters: AdminWorkspaceDirectoryFilters = {}) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql) return [];

  const query = safeText(filters.query, 160);
  const searchPattern = query ? `%${query}%` : null;
  const planStatus = safeText(filters.planStatus, 40);
  const attentionOnly = filters.attentionOnly === true;

  return sql`
    select
      w.id,
      w.name,
      w.slug,
      w.status,
      w.public_booking_slug,
      coalesce(ws.company_name, w.company_name, w.name) as company_name,
      coalesce(ws.contact_email, w.contact_email) as contact_email,
      coalesce(ws.contact_phone, w.contact_phone) as contact_phone,
      coalesce(p.plan_key, 'none') as plan_key,
      coalesce(p.status, 'none') as plan_status,
      p.current_period_end,
      count(distinct wm.id)::int as member_count,
      (select count(*)::int from workspace_services s where s.workspace_id = w.id::text and s.is_active = true) as active_service_count,
      (p.status = 'trialing' and p.current_period_end is not null and p.current_period_end <= now() + interval '3 days') as trial_ending_soon,
      (coalesce(ws.contact_email, w.contact_email, '') = '' or coalesce(ws.contact_phone, w.contact_phone, '') = '') as contact_incomplete,
      (w.public_booking_slug is null or w.public_booking_slug = '') as booking_page_missing,
      ((select count(*) from workspace_services s where s.workspace_id = w.id::text and s.is_active = true) = 0) as services_missing,
      (count(distinct wm.id) = 0) as members_missing
    from workspaces w
    left join workspace_settings ws on ws.workspace_id = w.id::text
    left join lateral (
      select plan_key, status, current_period_end
      from workspace_plans
      where workspace_id = w.id
      order by created_at desc
      limit 1
    ) p on true
    left join workspace_memberships wm on wm.workspace_id = w.id
    where (
      ${searchPattern} is null
      or w.name ilike ${searchPattern}
      or w.slug ilike ${searchPattern}
      or coalesce(ws.company_name, w.company_name, '') ilike ${searchPattern}
      or coalesce(ws.contact_email, w.contact_email, '') ilike ${searchPattern}
    )
      and (${planStatus} is null or coalesce(p.status, 'none') = ${planStatus})
    group by w.id, ws.company_name, ws.contact_email, ws.contact_phone,
      p.plan_key, p.status, p.current_period_end
    having (
      ${attentionOnly} = false
      or (
        (p.status = 'trialing' and p.current_period_end is not null and p.current_period_end <= now() + interval '3 days')
        or coalesce(ws.contact_email, w.contact_email, '') = ''
        or coalesce(ws.contact_phone, w.contact_phone, '') = ''
        or w.public_booking_slug is null
        or w.public_booking_slug = ''
        or (select count(*) from workspace_services s where s.workspace_id = w.id::text and s.is_active = true) = 0
        or count(distinct wm.id) = 0
      )
    )
    order by
      case when p.status = 'trialing' and p.current_period_end <= now() + interval '3 days' then 0 else 1 end,
      coalesce(ws.company_name, w.company_name, w.name) asc
  `;
}
