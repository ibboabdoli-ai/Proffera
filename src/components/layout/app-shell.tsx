"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import {
  isAuthSurfacePath,
  isRouteResolvedPublicLocalePath,
  resolvePublicRequestLocale,
} from "@/lib/public-locale";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = resolvePublicRequestLocale(pathname, searchParams.get("lang"));
  // Guest booking self-service already supplies its own workspace-branded,
  // localized header and footer. Do not wrap it with the Proffera site shell.
  const isCustomerPortal = Boolean(pathname?.startsWith("/mina-bokningar/"));
  const requestedPortalLanguage = searchParams.get("lang");
  const authSurface = isAuthSurfacePath(pathname);
  const marketplaceHome = pathname === "/" || pathname === "/en";
  const directorySearchRoute = pathname === "/foretag/listad" || pathname === "/en/companies";
  const directoryProfileRoute = pathname?.startsWith("/foretag/listad/")
    || pathname?.startsWith("/en/companies/");
  const routeResolvedLocale = isRouteResolvedPublicLocalePath(pathname);

  useEffect(() => {
    if (isCustomerPortal) {
      // Trust the language resolved by the portal page (not the raw query,
      // which could request Arabic for a tenant where it is not enabled).
      const resolvedLanguage = document.querySelector<HTMLElement>("main[lang]")?.lang;
      if (resolvedLanguage === "sv" || resolvedLanguage === "en" || resolvedLanguage === "ar") {
        document.documentElement.lang = resolvedLanguage;
        document.documentElement.dir = resolvedLanguage === "ar" ? "rtl" : "ltr";
      }
      return;
    }
    if (routeResolvedLocale) return;
    document.documentElement.lang = locale === "en" ? "en" : "sv";
    document.documentElement.dir = "ltr";
  }, [locale, routeResolvedLocale, isCustomerPortal, requestedPortalLanguage]);

  const isStandaloneRoute = pathname?.startsWith("/admin")
    || pathname?.startsWith("/dashboard")
    || pathname?.startsWith("/demo/")
    || pathname?.startsWith("/boka")
    || isCustomerPortal
    || pathname?.startsWith("/foretag/")
    || pathname?.startsWith("/review/");

  if (directoryProfileRoute) {
    return <>{children}</>;
  }

  if (isStandaloneRoute && !directorySearchRoute) {
    return <main>{children}</main>;
  }

  const marketplace = marketplaceHome || directorySearchRoute || authSurface;

  return (
    <>
      <Header locale={locale} />
      <main>{children}</main>
      <Footer locale={locale} marketplace={marketplace} />
    </>
  );
}
