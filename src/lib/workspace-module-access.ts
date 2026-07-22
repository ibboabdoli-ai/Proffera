import "server-only";

import { getSql } from "@/lib/db/server";
import {
  getProfferaModuleAccess,
  profferaModules,
  type ProfferaModuleAccess,
  type ProfferaModuleId,
} from "@/lib/proffera-modules";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

export type WorkspaceFeatureKey = "booking_demo" | "crm_customers" | "lead_inbox" | "ai_assistant";

const moduleFeatureKeys: Partial<Record<ProfferaModuleId, string[]>> = {
  online_booking: ["booking_demo"],
  customer_crm: ["crm_customers"],
  ai_chat: ["ai_assistant"],
  qr_booking: ["booking_demo"],
};

async function readEnabledFeatureKeys(): Promise<Set<string> | null> {
  const sql = getSql();
  const access = await getUserWorkspaceAccess();

  if (!sql || !access.ok) return null;

  const rows = await sql`
    with latest_plan as (
      select wp.plan_key, wp.status
      from workspace_plans wp
      where wp.workspace_id = ${access.workspaceId}::uuid
      order by wp.created_at desc
      limit 1
    )
    select feature_key
    from workspace_feature_flags
    where workspace_id = ${access.workspaceId}::uuid
      and enabled = true
      and exists (select 1 from latest_plan where status in ('active', 'trialing'))

    union

    -- Professional includes AI Chat. Keeping this derived from the current
    -- plan also makes the feature available to subscriptions created before
    -- the AI-specific feature flag existed.
    select 'ai_assistant'::text as feature_key
    from latest_plan
    where plan_key = 'professional'
      and status in ('active', 'trialing')
  `;

  return new Set(rows.map((row) => String(row.feature_key)));
}

export async function getDashboardEnabledFeatureKeys(): Promise<WorkspaceFeatureKey[]> {
  try {
    const enabledFeatures = await readEnabledFeatureKeys();
    if (!enabledFeatures) return [];

    return [...enabledFeatures].filter((feature): feature is WorkspaceFeatureKey =>
      ["booking_demo", "crm_customers", "lead_inbox", "ai_assistant"].includes(feature),
    );
  } catch (error) {
    console.error("Failed to read workspace feature access", error);
    return [];
  }
}

export async function hasDashboardFeatureAccess(featureKey: WorkspaceFeatureKey): Promise<boolean> {
  const enabledFeatures = await getDashboardEnabledFeatureKeys();
  return enabledFeatures.includes(featureKey);
}

export async function hasDashboardModuleAccess(moduleId: ProfferaModuleId): Promise<boolean> {
  const moduleDefinition = profferaModules.find((item) => item.id === moduleId);
  const requiredFeatures = moduleFeatureKeys[moduleId];

  if (!moduleDefinition) return false;
  if (!requiredFeatures) return moduleDefinition.accessState === "active";

  try {
    const enabledFeatures = await readEnabledFeatureKeys();
    if (!enabledFeatures) return false;

    return requiredFeatures.every((feature) => enabledFeatures.has(feature));
  } catch (error) {
    console.error("Failed to verify workspace module access", error);
    return false;
  }
}

export async function getDashboardModuleAccess(): Promise<ProfferaModuleAccess[]> {
  try {
    const enabledFeatures = await readEnabledFeatureKeys();
    if (!enabledFeatures) return getProfferaModuleAccess();

    return profferaModules.map((module) => {
      const requiredFeatures = moduleFeatureKeys[module.id];

      if (!requiredFeatures) {
        return {
          ...module,
          isEnabled: module.accessState === "active",
          isLocked: module.accessState === "locked",
        };
      }

      const isEnabled = requiredFeatures.every((feature) => enabledFeatures.has(feature));
      const accessState = isEnabled ? "active" : module.accessState === "planned" ? "planned" : "locked";

      return {
        ...module,
        accessState,
        isEnabled,
        isLocked: accessState === "locked",
      };
    });
  } catch (error) {
    console.error("Failed to read workspace module access", error);
    return getProfferaModuleAccess();
  }
}
