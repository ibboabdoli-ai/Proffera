"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  getAlternateLocalePath,
  getLocalizedRoute,
  getPublicNavigation,
  localeCopy,
  type PublicLocale,
} from "@/lib/public-locale";
import { ButtonLink } from "@/components/ui/button-link";

type HeaderProps = {
  locale: PublicLocale;
};

const marketplaceNavigation = {
  sv: [
    { label: "Hitta företag", href: "/foretag/listad" },
    { label: "Populära tjänster", href: "#populara-tjanster" },
    { label: "Så fungerar det", href: "#sa-fungerar" },
  ],
  en: [
    { label: "Find businesses", href: "/en/companies" },
    { label: "Popular services", href: "#populara-tjanster" },
    { label: "How it works", href: "#sa-fungerar" },
  ],
} as const;

export function Header({ locale }: HeaderProps) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const copy = localeCopy[locale];
  const marketplaceHome = pathname === "/" || pathname === "/en";
  const navigation = marketplaceHome ? marketplaceNavigation[locale] : getPublicNavigation(locale);
  const alternateLocalePath = getAlternateLocalePath(pathname);
  const homeHref = getLocalizedRoute("/", locale);
  const signupHref = getLocalizedRoute("/skapa-konto", locale);
  const businessHref = getLocalizedRoute("/for-foretag", locale);
  const primaryHref = marketplaceHome ? businessHref : signupHref;
  const primaryLabel = marketplaceHome ? (locale === "en" ? "For businesses" : "För företag") : copy.primaryCtaLabel;
  const loginHref = locale === "en" ? "/logga-in?lang=en" : "/logga-in?lang=sv";

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  useEffect(() => {
    closeMenu();
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-[#dfe5dd]/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href={homeHref} className="flex items-center" aria-label={copy.homeLabel}>
          <Image
            src="/brand/proffera-logo.svg"
            alt="Proffera"
            width={184}
            height={48}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-[#526057] lg:flex" aria-label={copy.navigationLabel}>
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-[#17452f] focus:outline-none focus-visible:text-[#17452f]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <Link href={loginHref} className="text-sm font-semibold text-[#17452f] transition hover:text-[#0e2e1e] focus:outline-none focus-visible:text-[#0e2e1e]">
            {copy.loginLabel}
          </Link>
          {alternateLocalePath ? (
            <Link
              href={alternateLocalePath}
              aria-label={copy.languageLabel}
              className="rounded-lg border border-[#cfd8cf] px-2.5 py-2 text-xs font-bold tracking-wide text-[#17452f] transition hover:bg-[#eef5ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17452f]"
            >
              {locale === "en" ? "SV" : "EN"}
            </Link>
          ) : null}
          <ButtonLink href={primaryHref}>{primaryLabel}</ButtonLink>
        </div>

        <details ref={menuRef} className="relative lg:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center rounded-xl border border-[#d7ded5] px-4 text-sm font-semibold text-[#17452f] marker:hidden transition hover:bg-[#eef5ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17452f]">
            {copy.menuLabel}
          </summary>
          <div className="absolute right-0 top-[3.25rem] w-72 rounded-2xl border border-[#dfe5dd] bg-white p-3 shadow-xl shadow-[#102a1c]/10">
            <nav className="grid gap-1" aria-label={copy.mobileNavigationLabel}>
              {navigation.map((item) => (
                <Link key={item.href} href={item.href} onClick={closeMenu} className="rounded-xl px-3 py-2.5 text-sm font-medium text-[#344139] transition hover:bg-[#f2f6f2] hover:text-[#17452f]">
                  {item.label}
                </Link>
              ))}
              <Link href={loginHref} onClick={closeMenu} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[#17452f] transition hover:bg-[#f2f6f2]">
                {copy.loginLabel}
              </Link>
              {alternateLocalePath ? (
                <Link
                  href={alternateLocalePath}
                  onClick={closeMenu}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[#17452f] transition hover:bg-[#f2f6f2]"
                >
                  {locale === "en" ? "Svenska" : "English"}
                </Link>
              ) : null}
              <ButtonLink href={primaryHref} onClick={closeMenu} className="mt-2 w-full">
                {primaryLabel}
              </ButtonLink>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
