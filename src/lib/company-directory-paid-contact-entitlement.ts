import "server-only";

import { getSql } from "@/lib/db/server";
import { isWorkspacePlanFeatureIncluded, type WorkspacePlanKey } from "@/lib/workspace-feature-policy";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Public Directory contact details are a paid entitlement. Free, Trial and
 * unclaimed profiles remain locked; only an active paid plan can disclose
 * phone, email, website and street address to anonymous visitors.
 */
export async function hasActivePaidDirectoryContactAccess(
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
    console.error("Failed to resolve paid Directory contact access", error);
    return false;
  }
}
