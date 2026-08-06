export type BillingAlertKind =
  | "trial_ending_7_days"
  | "trial_ending_3_days"
  | "trial_ending_tomorrow"
  | "trial_expired"
  | "past_due";

export type BillingAlert = {
  workspaceId: string;
  companyName: string;
  kind: BillingAlertKind;
  label: string;
  severity: "warning" | "critical";
  currentPeriodEnd: string | null;
  billingSource: "stripe" | "internal";
  dedupeKey: string;
};

type BillingAlertWorkspace = Record<string, unknown>;

const DAY_MS = 24 * 60 * 60 * 1000;

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function alertDefinition(kind: BillingAlertKind) {
  switch (kind) {
    case "past_due":
      return { label: "Betalning är försenad", severity: "critical" as const };
    case "trial_expired":
      return { label: "Trialperioden har gått ut", severity: "critical" as const };
    case "trial_ending_tomorrow":
      return { label: "Trialperioden slutar i morgon", severity: "critical" as const };
    case "trial_ending_3_days":
      return { label: "Trialperioden slutar inom 3 dagar", severity: "warning" as const };
    case "trial_ending_7_days":
      return { label: "Trialperioden slutar inom 7 dagar", severity: "warning" as const };
  }
}

export function detectBillingAlertKind(input: {
  status: unknown;
  currentPeriodEnd: unknown;
  now?: Date;
}): BillingAlertKind | null {
  const status = asText(input.status).toLowerCase();
  if (status === "past_due") return "past_due";
  if (status !== "trialing") return null;

  const periodEnd = new Date(asText(input.currentPeriodEnd));
  if (Number.isNaN(periodEnd.getTime())) return null;

  const remainingMs = periodEnd.getTime() - (input.now ?? new Date()).getTime();
  if (remainingMs <= 0) return "trial_expired";
  if (remainingMs <= DAY_MS) return "trial_ending_tomorrow";
  if (remainingMs <= 3 * DAY_MS) return "trial_ending_3_days";
  if (remainingMs <= 7 * DAY_MS) return "trial_ending_7_days";
  return null;
}

export function buildBillingAlertQueue(
  workspaces: BillingAlertWorkspace[],
  now = new Date(),
): BillingAlert[] {
  return workspaces.flatMap((workspace) => {
    const kind = detectBillingAlertKind({
      status: workspace.subscription_status,
      currentPeriodEnd: workspace.current_period_end,
      now,
    });
    if (!kind) return [];

    const workspaceId = asText(workspace.id);
    const companyName = asText(workspace.company_name) || "Okänt workspace";
    const rawPeriodEnd = asText(workspace.current_period_end);
    const periodEnd = rawPeriodEnd && !Number.isNaN(new Date(rawPeriodEnd).getTime())
      ? new Date(rawPeriodEnd).toISOString()
      : null;
    const billingSource = workspace.stripe_bound ? "stripe" : "internal";
    const definition = alertDefinition(kind);

    return [{
      workspaceId,
      companyName,
      kind,
      label: definition.label,
      severity: definition.severity,
      currentPeriodEnd: periodEnd,
      billingSource,
      dedupeKey: `billing-alert:${workspaceId}:${kind}:${periodEnd ?? "no-period"}`,
    }];
  });
}
