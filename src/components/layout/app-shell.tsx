"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import {
  getPublicLocale,
  isAuthQueryLocalePath,
  isAuthSurfacePath,
  PUBLIC_LOCALE_CHANGE_EVENT,
  type PublicLocale,
} from "@/lib/public-locale";

export function AppShell({
  children,
  localeHint,
}: Readonly<{ children: React.ReactNode; localeHint?: PublicLocale }>) {
  const pathname = usePathname();
  const pathLocale = getPublicLocale(pathname);
  const queryLocalizedAuth = isAuthQueryLocalePath(pathname);
  const hintedLocale = queryLocalizedAuth && localeHint ? localeHint : pathLocale;
  const [authLocaleOverride, setAuthLocaleOverride] = useState<{
    pathname: string;
    locale: PublicLocale;
  } | null>(null);
  const locale = queryLocalizedAuth && authLocaleOverride?.pathname === pathname
    ? authLocaleOverride.locale
    : hintedLocale;
  const authSurface = isAuthSurfacePath(pathname);
  const marketplaceHome = pathname === "/" || pathname === "/en";
  const directorySearchRoute = pathname === "/foretag/listad" || pathname === "/en/companies";
  const directoryProfileRoute = pathname?.startsWith("/foretag/listad/")
    || pathname?.startsWith("/en/companies/");
  useEffect(() => {
    if (!queryLocalizedAuth) return;

    function handleLocaleChange(event: Event) {
      const nextLocale = (event as CustomEvent<PublicLocale>).detail;
      if (nextLocale === "sv" || nextLocale === "en") {
        setAuthLocaleOverride({ pathname: pathname ?? "", locale: nextLocale });
      }
    }

    window.addEventListener(PUBLIC_LOCALE_CHANGE_EVENT, handleLocaleChange);
    return () => window.removeEventListener(PUBLIC_LOCALE_CHANGE_EVENT, handleLocaleChange);
  }, [pathname, queryLocalizedAuth]);

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "sv";
  }, [locale]);

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
