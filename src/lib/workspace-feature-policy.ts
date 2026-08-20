export type WorkspacePlanKey = "starter" | "professional" | "business";

const planRank: Record<WorkspacePlanKey, number> = {
  starter: 1,
  professional: 2,
  business: 3,
};

export function normalizeWorkspacePlan(value: unknown): WorkspacePlanKey | null {
  return value === "starter" || value === "professional" || value === "business" ? value : null;
}

function hasCurrentPeriod(value: unknown, now: Date) {
  if (value === null || value === undefined) return null;
  const periodEnd = new Date(String(value));
  if (Number.isNaN(periodEnd.getTime())) return false;
  return periodEnd.getTime() > now.getTime();
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
  const now = input.now ?? new Date();

  if (planStatus === "trialing") {
    // Workspace trials intentionally unlock the full product surface, regardless
    // of catalog tier, but they must still be attached to a real supported plan.
    // Never let a malformed/missing plan key turn a future date into entitlement.
    if (!planKey) return false;
    return hasCurrentPeriod(input.planPeriodEnd, now) === true;
  }

  if (!planKey || planStatus !== "active" || planRank[planKey] < planRank[minimumPlan]) {
    return false;
  }

  // Internal/manual active plans may intentionally have no period end. When an
  // active plan does carry an end date (for example a Stripe-synchronised plan),
  // fail closed once that period is expired or malformed instead of trusting a
  // stale `active` status after a missed webhook.
  return hasCurrentPeriod(input.planPeriodEnd, now) !== false;
}
