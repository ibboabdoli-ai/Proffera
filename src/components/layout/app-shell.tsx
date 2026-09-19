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
  const authSurface = isAuthSurfacePath(pathname);
  const marketplaceHome = pathname === "/" || pathname === "/en";
  const directorySearchRoute = pathname === "/foretag/listad" || pathname === "/en/companies";
  const directoryProfileRoute = pathname?.startsWith("/foretag/listad/")
    || pathname?.startsWith("/en/companies/");
  const routeResolvedLocale = isRouteResolvedPublicLocalePath(pathname);

  useEffect(() => {
    if (routeResolvedLocale) return;
    document.documentElement.lang = locale === "en" ? "en" : "sv";
  }, [locale, routeResolvedLocale]);

  const isStandaloneRoute = pathname?.startsWith("/admin")
    || pathname?.startsWith("/dashboard")
    || pathname?.startsWith("/demo/")
    || pathname?.startsWith("/boka")
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
