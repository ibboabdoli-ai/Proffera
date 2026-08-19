import "server-only";

import { getSql } from "@/lib/db/server";
import { resolveWorkspaceFeatureAccess } from "@/lib/workspace-feature-access";
import {
  isWorkspacePlanFeatureIncluded,
  type WorkspacePlanKey,
} from "@/lib/workspace-feature-policy";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkspaceDirectoryPublicAccess = {
  planAccess: boolean;
  websiteBuilder: boolean;
  onlineBooking: boolean;
};

function emptyDirectoryPublicAccess(): WorkspaceDirectoryPublicAccess {
  return {
    planAccess: false,
    websiteBuilder: false,
    onlineBooking: false,
  };
}

function featureTrialActive(status: unknown, endsAt: unknown, now: Date) {
  if (String(status ?? "") !== "active" || !endsAt) return false;
  const parsed = new Date(String(endsAt));
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime();
}

function optionalBoolean(value: unknown) {
  return value === null || value === undefined ? null : Boolean(value);
}

export async function hasWorkspacePlanAccessForWorkspace(
  workspaceId: string,
  minimumPlan: WorkspacePlanKey = "starter",
) {
  const sql = getSql();
  if (!sql || !uuidPattern.test(workspaceId)) return false;

  try {
    const rows = await sql`
      select plan_key, status, current_period_end
      from workspace_plans
      where workspace_id = ${workspaceId}::uuid
      order by created_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row) return false;

    return isWorkspacePlanFeatureIncluded({
      planKey: row.plan_key,
      planStatus: row.status,
      planPeriodEnd: row.current_period_end,
      minimumPlan,
      now: new Date(),
    });
  } catch (error) {
    console.error("Failed to resolve workspace plan access", error);
    return false;
  }
}

/**
 * Public company contact details are a paid entitlement. Product trials may
 * unlock workspace features, but they must not publish phone/email/address to
 * anonymous visitors before the workspace has an active paid plan.
 */
export async function hasWorkspaceActivePaidPlanAccessForWorkspace(
  workspaceId: string,
  minimumPlan: WorkspacePlanKey = "starter",
) {
  const sql = getSql();
  if (!sql || !uuidPattern.test(workspaceId)) return false;

  try {
    const rows = await sql`
      select plan_key, status, current_period_end
      from workspace_plans
      where workspace_id = ${workspaceId}::uuid
      order by created_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row || String(row.status ?? "") !== "active") return false;

    return isWorkspacePlanFeatureIncluded({
      planKey: row.plan_key,
      planStatus: "active",
      planPeriodEnd: row.current_period_end,
      minimumPlan,
      now: new Date(),
    });
  } catch (error) {
    console.error("Failed to resolve paid workspace plan access", error);
    return false;
  }
}

export async function getWorkspaceDirectoryPublicAccessForWorkspaces(
  workspaceIds: string[],
): Promise<Map<string, WorkspaceDirectoryPublicAccess>> {
  const normalizedIds = [...new Set(
    workspaceIds
      .map((workspaceId) => workspaceId.trim().toLowerCase())
      .filter((workspaceId) => uuidPattern.test(workspaceId)),
  )];
  const accessByWorkspace = new Map<string, WorkspaceDirectoryPublicAccess>(
    normalizedIds.map((workspaceId) => [workspaceId, emptyDirectoryPublicAccess()]),
  );
  const sql = getSql();
  if (!sql || normalizedIds.length === 0) return accessByWorkspace;

  try {
    const workspaceIdCsv = normalizedIds.join(",");
    const rows = await sql`
      with requested as (
        select unnest(string_to_array(${workspaceIdCsv}, ',')::uuid[]) as workspace_id
      ), latest_plan as (
        select distinct on (plan.workspace_id)
          plan.workspace_id,
          plan.plan_key,
          plan.status,
          plan.current_period_end
        from workspace_plans plan
        join requested on requested.workspace_id = plan.workspace_id
        order by plan.workspace_id, plan.created_at desc
      ), feature_rows as (
        select
          requested.workspace_id,
          catalog.feature_key,
          catalog.minimum_plan,
          coalesce(flag.enabled, false) as workspace_enabled,
          override.enabled as admin_override_enabled,
          trial.status as trial_status,
          trial.ends_at as trial_ends_at
        from requested
        join feature_catalog catalog
          on catalog.feature_key in ('website_builder', 'online_booking')
         and catalog.is_active = true
        left join workspace_feature_flags flag
          on flag.workspace_id = requested.workspace_id
         and flag.feature_key = catalog.feature_key
        left join workspace_feature_overrides override
          on override.workspace_id = requested.workspace_id
         and override.feature_key = catalog.feature_key
        left join workspace_feature_trials trial
          on trial.workspace_id = requested.workspace_id
         and trial.feature_key = catalog.feature_key
      )
      select
        requested.workspace_id::text as workspace_id,
        plan.plan_key,
        plan.status as plan_status,
        plan.current_period_end as plan_period_end,
        feature.feature_key,
        feature.minimum_plan,
        feature.workspace_enabled,
        feature.admin_override_enabled,
        feature.trial_status,
        feature.trial_ends_at
      from requested
      left join latest_plan plan on plan.workspace_id = requested.workspace_id
      left join feature_rows feature on feature.workspace_id = requested.workspace_id
      order by requested.workspace_id, feature.feature_key
    `;

    const now = new Date();
    for (const row of rows) {
      const workspaceId = String(row.workspace_id ?? "").toLowerCase();
      const current = accessByWorkspace.get(workspaceId);
      if (!current) continue;

      current.planAccess = isWorkspacePlanFeatureIncluded({
        planKey: row.plan_key,
        planStatus: row.plan_status,
        planPeriodEnd: row.plan_period_end,
        minimumPlan: "starter",
        now,
      });

      const featureKey = String(row.feature_key ?? "");
      if (featureKey !== "website_builder" && featureKey !== "online_booking") continue;

      const includedInPlan = isWorkspacePlanFeatureIncluded({
        planKey: row.plan_key,
        planStatus: row.plan_status,
        planPeriodEnd: row.plan_period_end,
        minimumPlan: row.minimum_plan,
        now,
      });
      const hasAccess = resolveWorkspaceFeatureAccess({
        includedInPlan,
        trialActive: featureTrialActive(row.trial_status, row.trial_ends_at, now),
        workspaceEnabled: Boolean(row.workspace_enabled),
        adminOverrideEnabled: optionalBoolean(row.admin_override_enabled),
      }).hasAccess;

      if (featureKey === "website_builder") current.websiteBuilder = hasAccess;
      if (featureKey === "online_booking") current.onlineBooking = hasAccess;
    }

    return accessByWorkspace;
  } catch (error) {
    console.error("Failed to batch-resolve Directory workspace access", error);
    return new Map(normalizedIds.map((workspaceId) => [workspaceId, emptyDirectoryPublicAccess()]));
  }
}

export async function hasWorkspaceFeatureAccessForWorkspace(
  workspaceId: string,
  featureKey: string,
) {
  const sql = getSql();
  const normalizedFeatureKey = featureKey.trim();
  if (!sql || !uuidPattern.test(workspaceId) || !normalizedFeatureKey) return false;

  try {
    const rows = await sql`
      with latest_plan as (
        select plan_key, status, current_period_end
        from workspace_plans
        where workspace_id = ${workspaceId}::uuid
        order by created_at desc
        limit 1
      )
      select
        catalog.minimum_plan,
        coalesce(flag.enabled, false) as workspace_enabled,
        override.enabled as admin_override_enabled,
        plan.plan_key,
        plan.status as plan_status,
        plan.current_period_end as plan_period_end,
        trial.status as trial_status,
        trial.ends_at as trial_ends_at
      from feature_catalog catalog
      left join workspace_feature_flags flag
        on flag.workspace_id = ${workspaceId}::uuid
       and flag.feature_key = catalog.feature_key
      left join workspace_feature_overrides override
        on override.workspace_id = ${workspaceId}::uuid
       and override.feature_key = catalog.feature_key
      left join latest_plan plan on true
      left join workspace_feature_trials trial
        on trial.workspace_id = ${workspaceId}::uuid
       and trial.feature_key = catalog.feature_key
      where catalog.feature_key = ${normalizedFeatureKey}
        and catalog.is_active = true
      limit 1
    `;

    const row = rows[0];
    if (!row) return false;

    const now = new Date();
    const includedInPlan = isWorkspacePlanFeatureIncluded({
      planKey: row.plan_key,
      planStatus: row.plan_status,
      planPeriodEnd: row.plan_period_end,
      minimumPlan: row.minimum_plan,
      now,
    });

    return resolveWorkspaceFeatureAccess({
      includedInPlan,
      trialActive: featureTrialActive(row.trial_status, row.trial_ends_at, now),
      workspaceEnabled: Boolean(row.workspace_enabled),
      adminOverrideEnabled: optionalBoolean(row.admin_override_enabled),
    }).hasAccess;
  } catch (error) {
    console.error("Failed to resolve workspace feature access", error);
    return false;
  }
}
