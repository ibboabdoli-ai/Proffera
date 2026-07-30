"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Forces a document navigation for the dashboard language switch.
 *
 * Dashboard English currently includes client-side residual translation
 * boundaries. A soft Next.js navigation can leave translated DOM in place
 * after removing `lang=en`, so the URL changes while the Swedish UI does not.
 * A full navigation cleanly tears down the translation observers and renders
 * the requested locale from a fresh document.
 */
export function DashboardLanguageSwitchFix() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = searchParams.get("lang") === "en" ? "en" : "sv";

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      const label = anchor.textContent?.trim().toLowerCase();
      const isLanguageLabel = label === "svenska" || label === "english";
      if (!isLanguageLabel) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== pathname) return;

      const targetLocale = url.searchParams.get("lang") === "en" ? "en" : "sv";
      if (targetLocale === locale) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(`${url.pathname}${url.search}${url.hash}`);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [locale, pathname]);

  return null;
}
