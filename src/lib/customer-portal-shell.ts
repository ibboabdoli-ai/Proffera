/**
 * Booking self-service pages provide a workspace-branded, localized shell.
 * Keep marketing UI out of these pages, regardless of the requested language.
 */
export function isCustomerPortalSelfServicePath(pathname: string | null | undefined): boolean {
  return typeof pathname === "string"
    && pathname.startsWith("/mina-bokningar/")
    && pathname.length > "/mina-bokningar/".length;
}

export function resolvedCustomerPortalShellLanguage(
  pathname: string | null | undefined,
  routeLanguage: string | null | undefined,
): "sv" | "en" | "ar" | null {
  if (!isCustomerPortalSelfServicePath(pathname)) return null;
  // Only trust the language the portal server actually rendered. For tenants
  // without Arabic support, a spoofed ?lang=ar must not change the shell.
  if (routeLanguage === "sv" || routeLanguage === "en" || routeLanguage === "ar") {
    return routeLanguage;
  }
  return null;
}
