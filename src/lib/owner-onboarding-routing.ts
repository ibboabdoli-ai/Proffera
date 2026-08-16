export type OwnerOnboardingLocale = "sv" | "en";

export function resolveOwnerPostLoginPath(input: {
  locale: OwnerOnboardingLocale;
  accountCreated: boolean;
  selectedPlan: string | null;
}) {
  const language = encodeURIComponent(input.locale);
  if (input.selectedPlan) {
    return `/dashboard/installningar?plan=${encodeURIComponent(input.selectedPlan)}&lang=${language}`;
  }
  if (input.accountCreated) return `/dashboard/onboarding?lang=${language}`;
  return `/dashboard?lang=${language}`;
}

export function shouldShowOwnerOnboardingPrompt(input: {
  canManageSettings: boolean;
  onboardingComplete: boolean;
  activeServices: number;
}) {
  return input.canManageSettings && !input.onboardingComplete && input.activeServices === 0;
}
