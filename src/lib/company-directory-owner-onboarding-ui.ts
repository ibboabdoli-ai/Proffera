export type OwnerOnboardingLocale = "sv" | "en";

export function ownerOnboardingStatusPath(locale: OwnerOnboardingLocale, status: string) {
  const params = new URLSearchParams({ status });
  if (locale === "en") params.set("lang", "en");
  return `/dashboard/marknadsplats/lagg-till-foretag?${params.toString()}`;
}

export function ownerOnboardingErrorStatus(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "organization_number" || code === "sole_trader_identity") return "invalid";
  if (code === "rate_limited") return "rate_limited";
  return "source_error";
}

export function ownerOnboardingErrorRedirect(locale: OwnerOnboardingLocale, error: unknown) {
  return ownerOnboardingStatusPath(locale, ownerOnboardingErrorStatus(error));
}
