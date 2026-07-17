import "server-only";

import { getSql } from "@/lib/db/server";
import {
  getProfferaModuleAccess,
  profferaModules,
  type ProfferaModuleAccess,
  type ProfferaModuleId,
} from "@/lib/proffera-modules";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const moduleFeatureKeys: Partial<Record<ProfferaModuleId, string[]>> = {
  online_booking: ["booking_demo"],
  customer_crm: ["crm_customers", "lead_inbox"],
  ai_chat: ["ai_assistant"],
  qr_booking: ["booking_demo"],
};

export async function hasDashboardModuleAccess(moduleId: ProfferaModuleId): Promise<boolean> {
  const moduleDefinition = profferaModules.find((item) => item.id === moduleId);
  const requiredFeatures = moduleFeatureKeys[moduleId];

  if (!moduleDefinition) return false;
  if (!requiredFeatures) return moduleDefinition.accessState === "active";

  const sql = getSql();
  const access = await getUserWorkspaceAccess();

  if (!sql || !access.ok) return false;

  try {
    const rows = await sql`
      select feature_key
      from workspace_feature_flags
      where workspace_id = ${access.workspaceId}::uuid
        and enabled = true
    `;
    const enabledFeatures = new Set(rows.map((row) => String(row.feature_key)));

    return requiredFeatures.every((feature) => enabledFeatures.has(feature));
  } catch (error) {
    console.error("Failed to verify workspace module access", error);
    return false;
  }
}

export async function getDashboardModuleAccess(): Promise<ProfferaModuleAccess[]> {
  const sql = getSql();
  const access = await getUserWorkspaceAccess();

  if (!sql || !access.ok) {
    return getProfferaModuleAccess();
  }

  try {
    const rows = await sql`
      select feature_key
      from workspace_feature_flags
      where workspace_id = ${access.workspaceId}::uuid
        and enabled = true
    `;
    const enabledFeatures = new Set(rows.map((row) => String(row.feature_key)));

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
