export type FeatureAccessState = "included" | "trial" | "locked" | "disabled";

export function resolveWorkspaceFeatureAccess(input: {
  includedInPlan: boolean;
  trialActive: boolean;
  workspaceEnabled: boolean;
  adminOverrideEnabled: boolean | null;
}): { hasAccess: boolean; accessState: FeatureAccessState } {
  if (input.adminOverrideEnabled === true) {
    return { hasAccess: true, accessState: "included" };
  }

  if (input.adminOverrideEnabled === false) {
    return { hasAccess: false, accessState: "disabled" };
  }

  if (!input.workspaceEnabled && (input.includedInPlan || input.trialActive)) {
    return { hasAccess: false, accessState: "disabled" };
  }

  if (input.includedInPlan && input.workspaceEnabled) {
    return { hasAccess: true, accessState: "included" };
  }

  if (input.trialActive && input.workspaceEnabled) {
    return { hasAccess: true, accessState: "trial" };
  }

  return { hasAccess: false, accessState: "locked" };
}
