"use client";

import { ArrowRight, Globe2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { ButtonLink } from "@/components/ui/button-link";
import {
  getAlternateLocalePath,
  getLocalizedRoute,
  getPublicNavigation,
  localeCopy,
  type PublicLocale,
} from "@/lib/public-locale";

type HeaderProps = {
  locale: PublicLocale;
};

const marketplaceNavigation = {
  sv: [
    { label: "Hitta företag", href: "/foretag/listad" },
    { label: "Populära tjänster", href: "/#populara-tjanster" },
    { label: "Så fungerar det", href: "/#sa-fungerar" },
    { label: "Om oss", href: "/om" },
  ],
  en: [
    { label: "Find businesses", href: "/en/companies" },
    { label: "Popular services", href: "/en#populara-tjanster" },
    { label: "How it works", href: "/en#sa-fungerar" },
    { label: "About us", href: "/en/about" },
  ],
} as const;

export function Header({ locale }: HeaderProps) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const copy = localeCopy[locale];
  const marketplaceHome = pathname === "/" || pathname === "/en";
  const marketplaceSearch = pathname === "/foretag/listad" || pathname === "/en/companies";
  const marketplaceContext = marketplaceHome || marketplaceSearch;
  const navigation = marketplaceContext ? marketplaceNavigation[locale] : getPublicNavigation(locale);
  const alternateLocalePath = getAlternateLocalePath(pathname);
  const homeHref = getLocalizedRoute("/", locale);
  const signupHref = getLocalizedRoute("/skapa-konto", locale);
  const businessHref = getLocalizedRoute("/for-foretag", locale);
  const primaryHref = marketplaceContext ? businessHref : signupHref;
  const primaryLabel = marketplaceContext ? (locale === "en" ? "For businesses" : "För företag") : copy.primaryCtaLabel;
  const loginHref = locale === "en" ? "/logga-in?lang=en" : "/logga-in?lang=sv";

  function closeMenu() {
    menuRef.current?.removeAttribute("open");
  }

  useEffect(() => {
    closeMenu();
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const marketplaceText = "text-[#0a2e63]";
  const marketplaceHover = "hover:text-[#1469d8] focus-visible:text-[#1469d8]";

  return (
    <header className={marketplaceContext
      ? "sticky top-0 z-40 border-b border-[#dce4ee] bg-white/95 backdrop-blur-xl"
      : "sticky top-0 z-40 border-b border-[#dce4ee]/80 bg-white/90 backdrop-blur-xl"
    }>
      <div
        className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
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

        <nav
          className={`hidden items-center gap-7 text-sm font-semibold lg:flex ${marketplaceContext ? "text-[#22324c]" : "text-[#4f6178]"}`}
          aria-label={copy.navigationLabel}
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={marketplaceContext
                ? "transition hover:text-[#1469d8] focus:outline-none focus-visible:text-[#1469d8]"
                : "transition hover:text-[#0a2e63] focus:outline-none focus-visible:text-[#0a2e63]"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          {alternateLocalePath ? (
            <a
              href={alternateLocalePath}
              aria-label={copy.languageLabel}
              className={marketplaceContext
                ? `inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-bold tracking-wide ${marketplaceText} ${marketplaceHover} focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1469d8]`
                : "rounded-lg border border-[#cfdceb] px-2.5 py-2 text-xs font-bold tracking-wide text-[#0a2e63] transition hover:bg-[#eef5ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2e63]"
              }
            >
              {marketplaceContext ? <Globe2 className="h-4 w-4" aria-hidden="true" /> : null}
              {locale === "en" ? "SV" : "EN"}
            </a>
          ) : null}

          <Link
            href={loginHref}
            className={marketplaceContext
              ? "inline-flex min-h-10 items-center justify-center rounded-lg border border-[#cfd9e7] bg-white px-4 text-sm font-bold text-[#0a2e63] transition hover:bg-[#f6f9fd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1469d8]"
              : "text-sm font-semibold text-[#0a2e63] transition hover:text-[#1469d8] focus:outline-none focus-visible:text-[#1469d8]"
            }
          >
            {copy.loginLabel}
          </Link>

          {marketplaceContext ? (
            <Link
              href={primaryHref}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#0a2e63] px-4 text-sm font-black text-white transition hover:bg-[#082654] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1469d8] focus-visible:ring-offset-2"
            >
              {primaryLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <ButtonLink href={primaryHref}>{primaryLabel}</ButtonLink>
          )}
        </div>

        <details ref={menuRef} className="relative lg:hidden">
          <summary className={marketplaceContext
            ? "flex h-11 cursor-pointer list-none items-center rounded-xl border border-[#d7e0eb] px-4 text-sm font-semibold text-[#0a2e63] marker:hidden transition hover:bg-[#f6f9fd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1469d8]"
            : "flex h-11 cursor-pointer list-none items-center rounded-xl border border-[#d7e0eb] px-4 text-sm font-semibold text-[#0a2e63] marker:hidden transition hover:bg-[#eef5ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0a2e63]"
          }>
            {copy.menuLabel}
          </summary>

          <div className={marketplaceContext
            ? "absolute right-0 top-[3.25rem] w-72 rounded-2xl border border-[#dce4ee] bg-white p-3 shadow-xl shadow-[#0a2e63]/10"
            : "absolute right-0 top-[3.25rem] w-72 rounded-2xl border border-[#dce4ee] bg-white p-3 shadow-xl shadow-[#0a2e63]/10"
          }>
            <nav className="grid gap-1" aria-label={copy.mobileNavigationLabel}>
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className={marketplaceContext
                    ? "rounded-xl px-3 py-2.5 text-sm font-medium text-[#34465d] transition hover:bg-[#f6f9fd] hover:text-[#0a2e63]"
                    : "rounded-xl px-3 py-2.5 text-sm font-medium text-[#40536c] transition hover:bg-[#f6f9fd] hover:text-[#0a2e63]"
                  }
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href={loginHref}
                onClick={closeMenu}
                className={marketplaceContext
                  ? "rounded-xl px-3 py-2.5 text-sm font-semibold text-[#0a2e63] transition hover:bg-[#f6f9fd]"
                  : "rounded-xl px-3 py-2.5 text-sm font-semibold text-[#0a2e63] transition hover:bg-[#f6f9fd]"
                }
              >
                {copy.loginLabel}
              </Link>
              {alternateLocalePath ? (
                <a
                  href={alternateLocalePath}
                  onClick={closeMenu}
                  className={marketplaceContext
                    ? "rounded-xl px-3 py-2.5 text-sm font-semibold text-[#0a2e63] transition hover:bg-[#f6f9fd]"
                    : "rounded-xl px-3 py-2.5 text-sm font-semibold text-[#0a2e63] transition hover:bg-[#f6f9fd]"
                  }
                >
                  {locale === "en" ? "Svenska" : "English"}
                </a>
              ) : null}
              {marketplaceContext ? (
                <Link
                  href={primaryHref}
                  onClick={closeMenu}
                  className="mt-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0a2e63] px-4 text-sm font-black text-white"
                >
                  {primaryLabel}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              ) : (
                <ButtonLink href={primaryHref} onClick={closeMenu} className="mt-2 w-full">
                  {primaryLabel}
                </ButtonLink>
              )}
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
