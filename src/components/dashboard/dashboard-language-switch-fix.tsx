"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Forces a real document request for dashboard language changes.
 *
 * Some embedded iOS browsers, including Instagram's in-app browser, can keep
 * the existing Next.js document alive after a client-side locale navigation.
 * Submitting a native GET form bypasses the client router and requests a fresh
 * server-rendered document for the selected locale.
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
      if (label !== "svenska" && label !== "english") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname !== pathname) return;

      const targetLocale = label === "english" ? "en" : "sv";
      if (targetLocale === locale) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const form = document.createElement("form");
      form.method = "get";
      form.action = pathname;
      form.style.display = "none";

      const languageInput = document.createElement("input");
      languageInput.type = "hidden";
      languageInput.name = "lang";
      languageInput.value = targetLocale;
      form.appendChild(languageInput);

      const cacheInput = document.createElement("input");
      cacheInput.type = "hidden";
      cacheInput.name = "locale_reload";
      cacheInput.value = Date.now().toString();
      form.appendChild(cacheInput);

      document.body.appendChild(form);
      form.submit();
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [locale, pathname]);

  return null;
}
