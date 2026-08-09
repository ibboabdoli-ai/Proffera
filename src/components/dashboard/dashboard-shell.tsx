"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareQuote,
  Settings,
  Sparkles,
  UserRoundSearch,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { switchWorkspaceAction } from "@/app/dashboard/workspace-actions";
import { authClient } from "@/lib/auth-client";
import { dashboardNavigation, type ProfferaModuleAccess } from "@/lib/proffera-modules";
import type { WorkspaceOption } from "@/lib/workspace-access";
import type { WorkspaceFeatureKey } from "@/lib/workspace-module-access";

type DashboardLocale = "sv" | "en";

const navigationIcons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/leads": UserRoundSearch,
  "/dashboard/kunder": Users,
  "/dashboard/bokningar": CalendarDays,
  "/dashboard/uppdrag": BriefcaseBusiness,
  "/dashboard/omdomen": MessageSquareQuote,
  "/dashboard/analys": BarChart3,
  "/dashboard/ai-assistent": Bot,
  "/dashboard/installningar": Settings,
};

const englishNavigationLabels: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/leads": "Leads",
  "/dashboard/kunder": "Customers",
  "/dashboard/bokningar": "Bookings",
  "/dashboard/uppdrag": "Jobs",
  "/dashboard/kalender": "Calendar",
  "/dashboard/personal": "Staff",
  "/dashboard/galleri": "Gallery",
  "/dashboard/omdomen": "Reviews",
  "/dashboard/analys": "Analytics",
  "/dashboard/ai-assistent": "AI assistant",
  "/dashboard/installningar": "Settings",
};

const shellCopy = {
  sv: {
    portal: "Proffera kundportal",
    navigation: "Dashboard navigation",
    locked: "Låst",
    planned: "Planerad",
    lockedTitle: "Modulen är inte aktiverad för arbetsytan",
    switchWorkspace: "Byt arbetsyta",
    workspace: "Arbetsyta",
    activeWorkspace: "Aktiv arbetsyta",
    summary: "Leads, kunder och bokningar samlade.",
    openMenu: "Öppna meny",
    closeMenu: "Stäng meny",
    menuDialog: "Dashboardmeny",
    signingOut: "Loggar ut...",
    signOut: "Logga ut",
    language: "English",
  },
  en: {
    portal: "Proffera customer portal",
    navigation: "Dashboard navigation",
    locked: "Locked",
    planned: "Planned",
    lockedTitle: "This module is not enabled for the workspace",
    switchWorkspace: "Switch workspace",
    workspace: "Workspace",
    activeWorkspace: "Active workspace",
    summary: "Leads, customers and bookings in one place.",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menuDialog: "Dashboard menu",
    signingOut: "Signing out...",
    signOut: "Sign out",
    language: "Svenska",
  },
} as const;

function isActivePath(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function localizedHref(href: string, locale: DashboardLocale) {
  return locale === "en" ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

type NavigationLinksProps = {
  pathname: string;
  locale: DashboardLocale;
  moduleAccess?: ProfferaModuleAccess[];
  enabledFeatures?: WorkspaceFeatureKey[];
  canManageSettings: boolean;
  onNavigate?: () => void;
};

function NavigationLinks({ pathname, locale, moduleAccess, enabledFeatures, canManageSettings, onNavigate }: NavigationLinksProps) {
  const moduleAccessById = new Map(moduleAccess?.map((item) => [item.id, item]));
  const text = shellCopy[locale];

  return (
    <nav className="grid gap-1.5" aria-label={text.navigation}>
      {dashboardNavigation.map((item) => {
        if (item.href === "/dashboard/installningar" && !canManageSettings) return null;

        const isActive = isActivePath(pathname, item.href);
        const Icon = navigationIcons[item.href] ?? ChevronRight;
        const moduleState = "moduleId" in item ? moduleAccessById.get(item.moduleId) : undefined;
        const featureIsLocked = "featureKey" in item && !enabledFeatures?.includes(item.featureKey);
        const isLocked = moduleState?.accessState === "locked" || featureIsLocked;
        const isPlanned = moduleState?.accessState === "planned" || (!moduleAccess && item.href === "/dashboard/ai-assistent");
        const label = locale === "en" ? englishNavigationLabels[item.href] ?? item.label : item.label;
        const content = <><Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" /><span className="flex-1">{label}</span>{isLocked || isPlanned ? <span className={isActive ? "text-[10px] font-bold uppercase tracking-wide text-[#557061]" : "text-[10px] font-bold uppercase tracking-wide text-[#a8c4b0]"}>{isLocked ? text.locked : text.planned}</span> : null}</>;

        if (isLocked) {
          return <div key={item.href} aria-disabled="true" className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#9bb0a2] opacity-80" title={text.lockedTitle}>{content}</div>;
        }

        return <Link key={item.href} href={localizedHref(item.href, locale)} onClick={onNavigate} aria-current={isActive ? "page" : undefined} className={["group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition", isActive ? "bg-white text-[#173e2b] shadow-[0_8px_24px_rgba(0,0,0,0.12)]" : "text-[#d8e5dc] hover:bg-white/10 hover:text-white"].join(" ")} style={isActive ? undefined : { color: "#e1eee5" }}>{content}</Link>;
      })}
    </nav>
  );
}

function Brand({ workspaceName, locale }: { workspaceName: string; locale: DashboardLocale }) {
  return <Link href={locale === "en" ? "/en" : "/"} className="flex items-center gap-3 !text-white" style={{ color: "#ffffff" }}><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8ae52] text-lg font-black text-[#173124] shadow-lg shadow-black/15">P</span><span><span className="block truncate text-lg font-bold tracking-tight">{workspaceName}</span><span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c8dacd]">{shellCopy[locale].portal}</span></span></Link>;
}

function WorkspaceSwitcher({ workspaceId, workspaceOptions, locale }: { workspaceId?: string; workspaceOptions: WorkspaceOption[]; locale: DashboardLocale }) {
  if (!workspaceId || workspaceOptions.length < 2) return null;
  const text = shellCopy[locale];
  return <form action={switchWorkspaceAction} className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-3"><input type="hidden" name="lang" value={locale} /><label className="grid gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b6cbbd]">{text.switchWorkspace}<select name="workspace_id" defaultValue={workspaceId} className="min-h-11 w-full rounded-xl border border-white/15 bg-[#203b2d] px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none">{workspaceOptions.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label><button type="submit" className="mt-2 min-h-11 w-full rounded-xl bg-white px-3 text-sm font-bold text-[#173e2b]">{text.switchWorkspace}</button></form>;
}

export function DashboardShell({ children, workspaceName = "Proffera", workspaceId, workspaceOptions = [], moduleAccess, enabledFeatures, canManageSettings = false }: Readonly<{ children: React.ReactNode; workspaceName?: string; workspaceId?: string; workspaceOptions?: WorkspaceOption[]; moduleAccess?: ProfferaModuleAccess[]; enabledFeatures?: WorkspaceFeatureKey[]; canManageSettings?: boolean }>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale: DashboardLocale = searchParams.get("lang") === "en" ? "en" : "sv";
  const text = shellCopy[locale];
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const currentPage = dashboardNavigation.find((item) => isActivePath(pathname, item.href));
  const currentPageLabel = currentPage ? (locale === "en" ? englishNavigationLabels[currentPage.href] ?? currentPage.label : currentPage.label) : text.workspace;

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const result = (await authClient.signOut()) as { error?: unknown } | undefined;
      if (result?.error) { setIsSigningOut(false); return; }
      window.location.assign(locale === "en" ? "/logga-in?lang=en" : "/logga-in");
    } catch { setIsSigningOut(false); }
  }

  return (
    <div className="min-h-screen bg-[#f3f5f1] text-[#152019]" lang={locale}>
      <div className="grid min-h-screen lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen overflow-y-auto bg-[#142b20] px-4 py-5 lg:flex lg:flex-col">
          <div className="px-2"><Brand workspaceName={workspaceName} locale={locale} /></div>
          <div className="mt-9 flex-1"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8c4b0]">{text.workspace}</p><NavigationLinks pathname={pathname} locale={locale} moduleAccess={moduleAccess} enabledFeatures={enabledFeatures} canManageSettings={canManageSettings} /></div>
          <WorkspaceSwitcher workspaceId={workspaceId} workspaceOptions={workspaceOptions} locale={locale} />
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="flex items-center gap-2 text-[#e8c678]"><Sparkles className="h-4 w-4" /><p className="text-xs font-bold uppercase tracking-wide">{text.activeWorkspace}</p></div><p className="mt-2 truncate text-sm font-semibold text-white">{workspaceName}</p><p className="mt-1 text-xs leading-5 text-[#c6d8cb]">{text.summary}</p></div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-[#e0e5dd] bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setIsMobileMenuOpen(true)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#dce3da] bg-white text-[#173e2b] lg:hidden" aria-label={text.openMenu} aria-expanded={isMobileMenuOpen}><Menu className="h-5 w-5" /></button><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6c786f]">{workspaceName} · {text.portal}</p><h1 className="truncate text-lg font-bold tracking-tight text-[#16231b] sm:text-xl">{currentPageLabel}</h1></div></div><div className="flex items-center gap-2 sm:gap-3"><Link href={locale === "en" ? pathname : `${pathname}?lang=en`} className="rounded-xl border border-[#dce3da] bg-white px-3 py-2 text-xs font-bold text-[#17452f]">{text.language}</Link><div className="hidden items-center gap-2 rounded-full bg-[#eaf2ec] px-3 py-2 text-xs font-bold text-[#17452f] sm:flex"><span className="h-2 w-2 rounded-full bg-[#2e8b57]" />{text.activeWorkspace}</div><button type="button" onClick={handleSignOut} disabled={isSigningOut} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dce3da] bg-white px-3 text-sm font-semibold text-[#435047] disabled:opacity-70"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">{isSigningOut ? text.signingOut : text.signOut}</span></button></div></div></header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1500px]">{children}</div></main>
        </div>
      </div>

      {isMobileMenuOpen ? <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={text.menuDialog}><button type="button" className="absolute inset-0 bg-[#09150f]/55 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} aria-label={text.closeMenu} /><aside className="relative flex h-full w-[min(88vw,330px)] flex-col bg-[#142b20] px-4 py-5 shadow-2xl"><div className="flex items-center justify-between px-2"><Brand workspaceName={workspaceName} locale={locale} /><button type="button" onClick={() => setIsMobileMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white" aria-label={text.closeMenu}><X className="h-5 w-5" /></button></div><div className="mt-9 flex-1 overflow-y-auto"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a8c4b0]">{text.workspace}</p><NavigationLinks pathname={pathname} locale={locale} moduleAccess={moduleAccess} enabledFeatures={enabledFeatures} canManageSettings={canManageSettings} onNavigate={() => setIsMobileMenuOpen(false)} /><WorkspaceSwitcher workspaceId={workspaceId} workspaceOptions={workspaceOptions} locale={locale} /></div></aside></div> : null}
    </div>
  );
}
