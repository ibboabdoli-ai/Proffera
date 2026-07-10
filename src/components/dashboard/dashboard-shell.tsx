"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bot,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  UserRoundSearch,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";
import { dashboardNavigation } from "@/lib/proffera-modules";

const navigationIcons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/leads": UserRoundSearch,
  "/dashboard/kunder": Users,
  "/dashboard/bokningar": CalendarDays,
  "/dashboard/ai-assistent": Bot,
  "/dashboard/installningar": Settings,
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type NavigationLinksProps = {
  pathname: string;
  onNavigate?: () => void;
};

function NavigationLinks({ pathname, onNavigate }: NavigationLinksProps) {
  return (
    <nav className="grid gap-1.5" aria-label="Dashboard navigation">
      {dashboardNavigation.map((item) => {
        const isActive = isActivePath(pathname, item.href);
        const Icon = navigationIcons[item.href] ?? ChevronRight;
        const isPlanned = item.href === "/dashboard/ai-assistent";

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={[
              "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              isActive
                ? "bg-white text-[#173e2b] shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                : "text-white/70 hover:bg-white/8 hover:text-white",
            ].join(" ")}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            {isPlanned ? (
              <span className={isActive ? "text-[10px] font-bold uppercase tracking-wide text-[#557061]" : "text-[10px] font-bold uppercase tracking-wide text-white/40"}>
                Planerad
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 text-white">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8ae52] text-lg font-black text-[#173124] shadow-lg shadow-black/15">
        P
      </span>
      <span>
        <span className="block text-lg font-bold tracking-tight">Proffera</span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Kundportal</span>
      </span>
    </Link>
  );
}

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const currentPage = dashboardNavigation.find((item) => isActivePath(pathname, item.href));

  async function handleSignOut() {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      const result = (await authClient.signOut()) as { error?: unknown } | undefined;

      if (result?.error) {
        setIsSigningOut(false);
        return;
      }

      window.location.assign("/logga-in");
    } catch {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f5f1] text-[#152019]">
      <div className="grid min-h-screen lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen overflow-y-auto bg-[#142b20] px-4 py-5 lg:flex lg:flex-col">
          <div className="px-2">
            <Brand />
          </div>

          <div className="mt-9 flex-1">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Arbetsyta</p>
            <NavigationLinks pathname={pathname} />
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
            <div className="flex items-center gap-2 text-[#e8c678]">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-wide">Proffera</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-white">Allt kundarbete samlat</p>
            <p className="mt-1 text-xs leading-5 text-white/50">Leads, kunder och bokningar i en tydlig arbetsyta.</p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-[#e0e5dd] bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dce3da] bg-white text-[#173e2b] transition hover:bg-[#f3f6f2] lg:hidden"
                  aria-label="Öppna meny"
                  aria-expanded={isMobileMenuOpen}
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6c786f]">Proffera kundportal</p>
                  <h1 className="truncate text-lg font-bold tracking-tight text-[#16231b] sm:text-xl">
                    {currentPage?.label ?? "Arbetsyta"}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden items-center gap-2 rounded-full bg-[#eaf2ec] px-3 py-2 text-xs font-bold text-[#17452f] sm:flex">
                  <span className="h-2 w-2 rounded-full bg-[#2e8b57]" aria-hidden="true" />
                  Aktiv arbetsyta
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dce3da] bg-white px-3 text-sm font-semibold text-[#435047] transition hover:border-[#c8d2c6] hover:bg-[#f7f8f5] disabled:cursor-not-allowed disabled:opacity-70 sm:px-4"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{isSigningOut ? "Loggar ut..." : "Logga ut"}</span>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1500px]">{children}</div>
          </main>
        </div>
      </div>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Dashboardmeny">
          <button
            type="button"
            className="absolute inset-0 bg-[#09150f]/55 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Stäng meny"
          />
          <aside className="relative flex h-full w-[min(88vw,330px)] flex-col bg-[#142b20] px-4 py-5 shadow-2xl">
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/15"
                aria-label="Stäng meny"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-9 flex-1 overflow-y-auto">
              <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Arbetsyta</p>
              <NavigationLinks pathname={pathname} onNavigate={() => setIsMobileMenuOpen(false)} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
