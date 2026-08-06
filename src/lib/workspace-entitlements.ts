import "server-only";

import { getSql } from "@/lib/db/server";
import {
  isWorkspacePlanFeatureIncluded,
  normalizeWorkspacePlan,
  type WorkspacePlanKey,
} from "@/lib/workspace-feature-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export type PlanKey = WorkspacePlanKey;
export type FeatureAccessState = "included" | "trial" | "locked" | "disabled";

export type WorkspaceEntitlement = {
  featureKey: string;
  name: string;
  description: string;
  minimumPlan: PlanKey;
  trialDays: number;
  workspaceEnabled: boolean;
  planKey: PlanKey | null;
  planStatus: string | null;
  trialStatus: string | null;
  trialEndsAt: string | null;
  accessState: FeatureAccessState;
  hasAccess: boolean;
  canStartTrial: boolean;
};

export async function getWorkspaceEntitlements(): Promise<WorkspaceEntitlement[]> {
  const sql = getSql();
  const access = await getUserWorkspaceAccess();
  if (!sql || !access.ok) return [];

  const rows = await sql`
    with latest_plan as (
      select plan_key, status, current_period_end
      from workspace_plans
      where workspace_id = ${access.workspaceId}::uuid
      order by created_at desc
      limit 1
    )
    select c.feature_key, c.name, c.description, c.minimum_plan, c.trial_days,
      coalesce(f.enabled, false) as workspace_enabled,
      p.plan_key, p.status as plan_status, p.current_period_end as plan_period_end,
      t.status as trial_status, t.ends_at as trial_ends_at,
      (t.workspace_id is not null) as trial_consumed
    from feature_catalog c
    left join workspace_feature_flags f
      on f.workspace_id = ${access.workspaceId}::uuid and f.feature_key = c.feature_key
    left join latest_plan p on true
    left join workspace_feature_trials t
      on t.workspace_id = ${access.workspaceId}::uuid and t.feature_key = c.feature_key
    where c.is_active = true
    order by c.minimum_plan, c.name
  `;

  const now = new Date();
  return rows.map((row) => {
    const planKey = normalizeWorkspacePlan(row.plan_key);
    const minimumPlan = normalizeWorkspacePlan(row.minimum_plan) ?? "starter";
    const included = isWorkspacePlanFeatureIncluded({
      planKey: row.plan_key,
      planStatus: row.plan_status,
      planPeriodEnd: row.plan_period_end,
      minimumPlan: row.minimum_plan,
      now,
    });
    const trialEndsAt = row.trial_ends_at ? new Date(String(row.trial_ends_at)).toISOString() : null;
    const trialActive = String(row.trial_status ?? "") === "active"
      && Boolean(trialEndsAt)
      && new Date(trialEndsAt!).getTime() > now.getTime();
    const workspaceEnabled = Boolean(row.workspace_enabled);
    const hasAccess = (included || trialActive) && workspaceEnabled;
    const accessState: FeatureAccessState = !workspaceEnabled && (included || trialActive)
      ? "disabled"
      : included
        ? "included"
        : trialActive
          ? "trial"
          : "locked";

    return {
      featureKey: String(row.feature_key),
      name: String(row.name),
      description: String(row.description),
      minimumPlan,
      trialDays: Number(row.trial_days) || 0,
      workspaceEnabled,
      planKey,
      planStatus: row.plan_status ? String(row.plan_status) : null,
      trialStatus: row.trial_status ? String(row.trial_status) : null,
      trialEndsAt,
      accessState,
      hasAccess,
      canStartTrial: !included && !Boolean(row.trial_consumed) && Number(row.trial_days) > 0,
    } satisfies WorkspaceEntitlement;
  });
}

export async function hasWorkspaceFeature(featureKey: string): Promise<boolean> {
  const entitlements = await getWorkspaceEntitlements();
  return entitlements.some((item) => item.featureKey === featureKey && item.hasAccess);
}

export async function setWorkspaceFeatureEnabled(featureKey: string, enabled: boolean) {
  const sql = getSql();
  const access = await getUserWorkspaceAccess();
  if (!sql || !access.ok || !canManageWorkspaceSettings(access)) throw new Error("Owner or admin access required");

  const catalog = await sql`select feature_key from feature_catalog where feature_key = ${featureKey} and is_active = true limit 1`;
  if (!catalog[0]) throw new Error("Unknown feature");

  await sql`
    insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
    values (gen_random_uuid(), ${access.workspaceId}::uuid, ${featureKey}, ${enabled}, now(), now())
    on conflict (workspace_id, feature_key) do update set enabled = excluded.enabled, updated_at = now()
  `;
}

export async function startWorkspaceFeatureTrial(featureKey: string) {
  const sql = getSql();
  const access = await getUserWorkspaceAccess();
  if (!sql || !access.ok || !canManageWorkspaceSettings(access)) throw new Error("Owner or admin access required");

  const catalog = await sql`select trial_days from feature_catalog where feature_key = ${featureKey} and is_active = true limit 1`;
  const trialDays = Number(catalog[0]?.trial_days ?? 0);
  if (trialDays <= 0) throw new Error("Trial unavailable");

  const inserted = await sql`
    insert into workspace_feature_trials (workspace_id, feature_key, status, started_at, ends_at, created_at, updated_at)
    values (${access.workspaceId}::uuid, ${featureKey}, 'active', now(), now() + (${trialDays} || ' days')::interval, now(), now())
    on conflict (workspace_id, feature_key) do nothing
    returning feature_key
  `;
  if (!inserted[0]) throw new Error("Trial already used");

  await setWorkspaceFeatureEnabled(featureKey, true);
}
