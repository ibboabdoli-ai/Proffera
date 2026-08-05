import "server-only";

import { randomUUID } from "node:crypto";

import { getSql } from "@/lib/db/server";

const TRIAL_DAYS = 14;

type ProvisionWorkspaceInput = {
  workspaceId?: string;
  userId: string;
  slug: string;
  companyName: string;
  city: string;
  email: string;
  phone: string;
};

export async function provisionWorkspace(input: ProvisionWorkspaceInput) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const workspaceId = input.workspaceId ?? randomUUID();
  const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await sql.transaction((tx) => [
    tx`
      insert into workspaces (
        id, slug, public_booking_slug, name, company_name, primary_city,
        contact_email, contact_phone, status
      ) values (
        ${workspaceId}::uuid, ${input.slug}, ${input.slug}, ${input.companyName},
        ${input.companyName}, ${input.city}, ${input.email}, ${input.phone}, 'trial'
      )
      on conflict (id) do update set
        name = excluded.name,
        company_name = excluded.company_name,
        primary_city = excluded.primary_city,
        contact_email = excluded.contact_email,
        contact_phone = excluded.contact_phone,
        updated_at = now()
    `,
    tx`
      insert into workspace_memberships (id, workspace_id, user_id, role)
      values (gen_random_uuid(), ${workspaceId}::uuid, ${input.userId}, 'owner')
      on conflict (workspace_id, user_id) do update set role = 'owner'
    `,
    tx`
      insert into workspace_settings (
        workspace_id, company_name, primary_city, response_time_goal,
        default_cta, contact_email, contact_phone, billing_country_code,
        time_zone, billing_currency
      ) values (
        ${workspaceId}, ${input.companyName}, ${input.city}, 'Inom 24 timmar',
        'Boka tid', ${input.email}, ${input.phone}, 'SE', 'Europe/Stockholm', 'SEK'
      )
      on conflict (workspace_id) do update set
        company_name = excluded.company_name,
        primary_city = excluded.primary_city,
        contact_email = excluded.contact_email,
        contact_phone = excluded.contact_phone,
        updated_at = now()
    `,
    tx`
      insert into workspace_plans (
        id, workspace_id, plan_key, status, current_period_start,
        current_period_end, created_at, updated_at
      )
      select gen_random_uuid(), ${workspaceId}::uuid, 'starter', 'trialing', now(),
        ${trialEnd}::timestamptz, now(), now()
      where not exists (
        select 1 from workspace_plans where workspace_id = ${workspaceId}::uuid
      )
    `,
    tx`
      insert into workspace_experience_settings (workspace_id)
      values (${workspaceId}::uuid)
      on conflict (workspace_id) do nothing
    `,
    tx`
      insert into workspace_onboarding (workspace_id)
      values (${workspaceId}::uuid)
      on conflict (workspace_id) do nothing
    `,
    tx`
      insert into workspace_booking_reminder_settings (workspace_id)
      values (${workspaceId})
      on conflict (workspace_id) do nothing
    `,
    tx`
      insert into workspace_booking_hours (workspace_id, weekday, opens_at, closes_at, is_closed)
      values
        (${workspaceId}, 0, null, null, true),
        (${workspaceId}, 1, '09:00'::time, '17:00'::time, false),
        (${workspaceId}, 2, '09:00'::time, '17:00'::time, false),
        (${workspaceId}, 3, '09:00'::time, '17:00'::time, false),
        (${workspaceId}, 4, '09:00'::time, '17:00'::time, false),
        (${workspaceId}, 5, '09:00'::time, '17:00'::time, false),
        (${workspaceId}, 6, null, null, true)
      on conflict (workspace_id, weekday) do nothing
    `,
    tx`
      insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
      select gen_random_uuid(), ${workspaceId}::uuid, feature_key, minimum_plan = 'starter', now(), now()
      from feature_catalog
      where is_active = true
      on conflict (workspace_id, feature_key) do nothing
    `,
    tx`
      insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
      values
        (gen_random_uuid(), ${workspaceId}::uuid, 'booking_demo', true, now(), now()),
        (gen_random_uuid(), ${workspaceId}::uuid, 'lead_inbox', true, now(), now()),
        (gen_random_uuid(), ${workspaceId}::uuid, 'crm_customers', false, now(), now()),
        (gen_random_uuid(), ${workspaceId}::uuid, 'ai_assistant', false, now(), now())
      on conflict (workspace_id, feature_key) do nothing
    `,
  ]);

  return { workspaceId, trialEndsAt: trialEnd };
}
