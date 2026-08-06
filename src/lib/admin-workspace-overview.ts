import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function getAdminWorkspaceOverview(workspaceId: string) {
  const admin = await getPlatformAdmin();
  const sql = getSql();
  if (!admin || !sql || !isUuid(workspaceId)) return null;

  const rows = await sql`
    select
      w.id,
      w.name,
      w.slug,
      w.status,
      w.public_booking_slug,
      w.created_at,
      w.updated_at,
      coalesce(ws.company_name, w.company_name, w.name) as company_name,
      coalesce(ws.primary_city, w.primary_city) as primary_city,
      coalesce(ws.contact_email, w.contact_email) as contact_email,
      coalesce(ws.contact_phone, w.contact_phone) as contact_phone,
      ws.time_zone,
      ws.billing_currency,
      coalesce(p.plan_key, 'none') as plan_key,
      coalesce(p.status, 'none') as plan_status,
      p.current_period_start,
      p.current_period_end,
      (select count(*)::int from workspace_memberships wm where wm.workspace_id = w.id) as member_count,
      (select count(*)::int from customers c where c.workspace_id = w.id::text) as customer_count,
      (select count(*)::int from workspace_services s where s.workspace_id = w.id::text) as service_count,
      (select count(*)::int from workspace_services s where s.workspace_id = w.id::text and s.is_active = true) as active_service_count,
      (select count(*)::int from bookings b where b.workspace_id = w.id::text) as booking_count,
      (select count(*)::int from bookings b where b.workspace_id = w.id::text and b.starts_at >= now()) as upcoming_booking_count,
      (select count(*)::int from bookings b where b.workspace_id = w.id::text and b.created_at >= now() - interval '30 days') as bookings_last_30_days,
      greatest(
        w.updated_at,
        coalesce((select max(b.updated_at) from bookings b where b.workspace_id = w.id::text), w.updated_at),
        coalesce((select max(c.updated_at) from customers c where c.workspace_id = w.id::text), w.updated_at)
      ) as last_activity_at
    from workspaces w
    left join workspace_settings ws on ws.workspace_id = w.id::text
    left join lateral (
      select plan_key, status, current_period_start, current_period_end
      from workspace_plans
      where workspace_id = w.id
      order by created_at desc
      limit 1
    ) p on true
    where w.id = ${workspaceId}::uuid
    limit 1
  `;

  const workspace = rows[0];
  if (!workspace) return null;

  const [recentBookings, features] = await Promise.all([
    sql`
      select b.id, b.title, b.service, b.status, b.starts_at, b.created_at,
        c.name as customer_name, c.email as customer_email
      from bookings b
      left join customers c on c.id = b.customer_id
      where b.workspace_id = ${workspaceId}
      order by b.created_at desc
      limit 10
    `,
    sql`
      select
        c.feature_key,
        c.name,
        c.description,
        c.minimum_plan,
        c.trial_days,
        coalesce(f.enabled, false) as workspace_enabled,
        o.enabled as admin_override_enabled,
        t.status as trial_status,
        t.ends_at as trial_ends_at
      from feature_catalog c
      left join workspace_feature_flags f
        on f.workspace_id = ${workspaceId}::uuid and f.feature_key = c.feature_key
      left join workspace_feature_overrides o
        on o.workspace_id = ${workspaceId}::uuid and o.feature_key = c.feature_key
      left join workspace_feature_trials t
        on t.workspace_id = ${workspaceId}::uuid and t.feature_key = c.feature_key
      where c.is_active = true
      order by c.minimum_plan, c.name
    `,
  ]);

  return { workspace, recentBookings, features };
}
