import "server-only";

import { getSql } from "@/lib/db/server";
import { resolveWorkspaceFeatureAccess } from "@/lib/workspace-feature-access";
import { isWorkspacePlanFeatureIncluded } from "@/lib/workspace-feature-policy";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const trialEndsAt = row.trial_ends_at ? new Date(String(row.trial_ends_at)) : null;
    const trialActive =
      String(row.trial_status ?? "") === "active" &&
      Boolean(trialEndsAt) &&
      !Number.isNaN(trialEndsAt!.getTime()) &&
      trialEndsAt!.getTime() > now.getTime();
    const adminOverrideEnabled =
      row.admin_override_enabled === null || row.admin_override_enabled === undefined
        ? null
        : Boolean(row.admin_override_enabled);

    return resolveWorkspaceFeatureAccess({
      includedInPlan,
      trialActive,
      workspaceEnabled: Boolean(row.workspace_enabled),
      adminOverrideEnabled,
    }).hasAccess;
  } catch (error) {
    console.error("Failed to resolve workspace feature access", error);
    return false;
  }
}
