"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { getPublicLocale } from "@/lib/public-locale";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const locale = getPublicLocale(pathname);
  const isStandaloneRoute = pathname?.startsWith("/admin")
    || pathname?.startsWith("/dashboard")
    || pathname?.startsWith("/demo/");

  if (isStandaloneRoute) {
    return <main>{children}</main>;
  }

  return (
    <>
      <Header locale={locale} />
      <main>{children}</main>
      <Footer locale={locale} />
    </>
  );
}
