export const webVitalRouteGroups = [
  "marketing",
  "directory",
  "booking",
  "dashboard",
  "admin",
  "business-site",
  "demo",
  "other",
] as const;

export type WebVitalRouteGroup = (typeof webVitalRouteGroups)[number];

export function classifyWebVitalRoute(pathname: string): WebVitalRouteGroup {
  const path = pathname || "/";

  if (
    path === "/foretag/listad"
    || path.startsWith("/foretag/listad/")
    || path === "/en/companies"
    || path.startsWith("/en/companies/")
  ) {
    return "directory";
  }

  if (
    path === "/boka"
    || path.startsWith("/boka/")
    || path === "/booking"
    || path.startsWith("/booking/")
    || path === "/primeview-booking"
    || path.startsWith("/primeview-booking/")
  ) {
    return "booking";
  }

  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "dashboard";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  if (path === "/foretag" || path.startsWith("/foretag/")) return "business-site";
  if (path === "/demo" || path.startsWith("/demo/")) return "demo";

  if (
    path === "/"
    || path === "/en"
    || path === "/tjanster"
    || path.startsWith("/tjanster/")
    || path === "/en/services"
    || path.startsWith("/en/services/")
    || path === "/branscher"
    || path.startsWith("/branscher/")
    || path === "/en/industries"
    || path.startsWith("/en/industries/")
    || path === "/priser"
    || path === "/en/pricing"
    || path === "/om"
    || path === "/en/about"
    || path === "/kontakt"
    || path === "/en/contact"
    || path === "/integritetspolicy"
    || path === "/en/privacy"
    || path === "/villkor"
    || path === "/en/terms"
    || path === "/cookies"
    || path === "/en/cookies"
    || path === "/skapa-konto"
    || path === "/en/create-account"
    || path === "/anslut-foretag"
    || path === "/en/join-business"
  ) {
    return "marketing";
  }

  return "other";
}
