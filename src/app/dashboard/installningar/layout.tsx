"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { NavigationPrefetchLink } from "@/components/performance/navigation-prefetch-control";
import styles from "@/components/dashboard/secondary-workspace-ux-2.module.css";
import mobileStyles from "@/components/dashboard/settings-mobile-ux.module.css";

const settingsNavigation = [
  { href: "/dashboard/installningar", sv: "Översikt", en: "Overview" },
  { href: "/dashboard/installningar/funktioner", sv: "Funktioner", en: "Features" },
  { href: "/dashboard/installningar/utseende", sv: "Utseende & tema", en: "Appearance & theme" },
  { href: "/dashboard/installningar/foretagssida", sv: "Företagssida", en: "Business page" },
  { href: "/dashboard/installningar/paminnelser", sv: "Påminnelser", en: "Reminders" },
  { href: "/dashboard/installningar/betalningar", sv: "Betalningar", en: "Payments" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard/installningar") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEnglish = searchParams.get("lang") === "en";

  return (
    <div className={`${styles.scope} ${mobileStyles.scope} grid gap-6`}>
      <section data-settings-nav-panel className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-ink-muted">
              {isEnglish ? "Settings" : "Inställningar"}
            </p>
            <h2 className="mt-1 text-xl font-black text-ink">
              {isEnglish ? "Workspace configuration" : "Konfigurera arbetsytan"}
            </h2>
          </div>

          <nav data-settings-nav className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label={isEnglish ? "Settings navigation" : "Navigering för inställningar"}>
            {settingsNavigation.map((item) => {
              const active = isActive(pathname, item.href);
              const href = isEnglish ? `${item.href}?lang=en` : item.href;
              return (
                <NavigationPrefetchLink
                  key={item.href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-sm font-bold transition ${
                    active
                      ? "border-brand-deep bg-brand-deep text-white"
                      : "border-line bg-surface text-brand-deep hover:border-line-strong hover:bg-surface-subtle"
                  }`}
                >
                  {isEnglish ? item.en : item.sv}
                </NavigationPrefetchLink>
              );
            })}
          </nav>
        </div>
      </section>

      {children}
    </div>
  );
}
