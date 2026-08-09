"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

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
    <div className="grid gap-6">
      <section className="rounded-[24px] border border-[#dfe6df] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#68736b]">
              {isEnglish ? "Settings" : "Inställningar"}
            </p>
            <h2 className="mt-1 text-xl font-black text-[#17201a]">
              {isEnglish ? "Workspace configuration" : "Konfigurera arbetsytan"}
            </h2>
          </div>

          <nav className="flex max-w-full gap-2 overflow-x-auto pb-1" aria-label={isEnglish ? "Settings navigation" : "Navigering för inställningar"}>
            {settingsNavigation.map((item) => {
              const active = isActive(pathname, item.href);
              const href = isEnglish ? `${item.href}?lang=en` : item.href;
              return (
                <Link
                  key={item.href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-sm font-bold transition ${
                    active
                      ? "border-[#173e2b] bg-[#173e2b] text-white"
                      : "border-[#d9e1d7] bg-white text-[#173e2b] hover:border-[#9aab9f] hover:bg-[#f7f9f6]"
                  }`}
                >
                  {isEnglish ? item.en : item.sv}
                </Link>
              );
            })}
          </nav>
        </div>
      </section>

      {children}
    </div>
  );
}
