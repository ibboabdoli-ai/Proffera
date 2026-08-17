"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { getPublicLocale } from "@/lib/public-locale";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const locale = getPublicLocale(pathname);
  const marketplaceHome = pathname === "/" || pathname === "/en";
  const isDirectoryRoute = pathname?.startsWith("/foretag/listad")
    || pathname?.startsWith("/en/companies");
  const isStandaloneRoute = pathname?.startsWith("/admin")
    || pathname?.startsWith("/dashboard")
    || pathname?.startsWith("/demo/")
    || pathname?.startsWith("/boka")
    || pathname?.startsWith("/foretag/")
    || pathname?.startsWith("/review/");

  if (isDirectoryRoute) {
    return <>{children}</>;
  }

  if (isStandaloneRoute) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header locale={locale} />
      <main>{children}</main>
      <Footer locale={locale} marketplace={marketplaceHome} />
    </>
  );
}
