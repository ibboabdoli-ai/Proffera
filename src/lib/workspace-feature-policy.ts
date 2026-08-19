export type WorkspacePlanKey = "starter" | "professional" | "business";

const planRank: Record<WorkspacePlanKey, number> = {
  starter: 1,
  professional: 2,
  business: 3,
};

export function normalizeWorkspacePlan(value: unknown): WorkspacePlanKey | null {
  return value === "starter" || value === "professional" || value === "business" ? value : null;
}

export function isWorkspacePlanFeatureIncluded(input: {
  planKey: unknown;
  planStatus: unknown;
  planPeriodEnd: unknown;
  minimumPlan: unknown;
  now?: Date;
}): boolean {
  const planKey = normalizeWorkspacePlan(input.planKey);
  const minimumPlan = normalizeWorkspacePlan(input.minimumPlan) ?? "starter";
  const planStatus = String(input.planStatus ?? "");

  if (planStatus === "trialing") {
    // Workspace trials intentionally unlock the full product surface, regardless
    // of catalog tier, but they must still be attached to a real supported plan.
    // Never let a malformed/missing plan key turn a future date into entitlement.
    if (!planKey || !input.planPeriodEnd) return false;
    const periodEnd = new Date(String(input.planPeriodEnd));
    if (Number.isNaN(periodEnd.getTime())) return false;
    return periodEnd.getTime() > (input.now ?? new Date()).getTime();
  }

  return Boolean(planKey && planStatus === "active" && planRank[planKey] >= planRank[minimumPlan]);
}
