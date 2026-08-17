"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { getPublicLocale } from "@/lib/public-locale";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const locale = getPublicLocale(pathname);
  const marketplaceHome = pathname === "/" || pathname === "/en";
  const directorySearchRoute = pathname === "/foretag/listad" || pathname === "/en/companies";
  const directoryProfileRoute = pathname?.startsWith("/foretag/listad/")
    || pathname?.startsWith("/en/companies/");
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

  const marketplace = marketplaceHome || directorySearchRoute;

  return (
    <>
      <Header locale={locale} />
      <main>{children}</main>
      <Footer locale={locale} marketplace={marketplace} />
    </>
  );
}
