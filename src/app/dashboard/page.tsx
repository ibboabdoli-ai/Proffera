import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarCheck2,
  CalendarPlus,
  CheckCircle2,
  CircleUserRound,
  Settings,
  ShieldCheck,
  UserRoundPlus,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";

import { getDashboardStats } from "@/lib/dashboard-db";
import { getDashboardEnabledFeatureKeys, getDashboardModuleAccess } from "@/lib/workspace-module-access";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

type DashboardLocale = "sv" | "en";

type DashboardPageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function withLocale(href: string, locale: DashboardLocale) {
  return locale === "en" ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

function countLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

const copy = {
  sv: {
    quickLinks: [
      { title: "Leads", text: "Prioritera nya förfrågningar och se vilka kontakter som behöver första åtgärd.", href: "/dashboard/leads", icon: UserRoundSearch, label: "Förfrågningar", featureKey: "lead_inbox" },
      { title: "Kunder", text: "Öppna kundlistan, följ historik och håll ordning på relationer över tid.", href: "/dashboard/kunder", icon: UsersRound, label: "CRM", moduleId: "customer_crm" },
      { title: "Bokningar", text: "Se kommande bokningar, status och nästa steg från kundflödet.", href: "/dashboard/bokningar", icon: CalendarCheck2, label: "Planering", moduleId: "online_booking" },
      { title: "AI-assistent", text: "Visa hur AI kan fånga frågor, kvalificera behov och skicka vidare tydliga leads.", href: "/dashboard/ai-assistent", icon: Bot, label: "Planerad modul" },
      { title: "Inställningar", text: "Hantera företagsprofil, kontaktuppgifter, tjänster och AI-underlag.", href: "/dashboard/installningar", icon: Settings, label: "Konfiguration" },
    ],
    activeBadge: "Arbetsytan är aktiv",
    limitedHeading: "Din arbetsyta är redo när modulerna aktiveras.",
    heading: "Full kontroll över varje kundrelation.",
    limitedIntro: "CRM och bokningar är inte aktiverade för den här arbetsytan. Kontakta Owner eller Proffera för hjälp.",
    intro: "Prioritera nya förfrågningar, följ bokningar och håll kundarbetet i rörelse från en samlad översikt.",
    manageLeads: "Hantera leads",
    newBooking: "Ny bokning",
    customers: "Kunder",
    bookings: "Bokningar",
    activity: "Aktivitet",
    workspace: "Arbetsyta",
    active: "Aktiv",
    customerSingular: "kund",
    customerPlural: "kunder",
    activeSingular: "aktiv",
    activePlural: "aktiva",
    bookingSingular: "bokning",
    bookingPlural: "bokningar",
    confirmedSingular: "bekräftad",
    confirmedPlural: "bekräftade",
    activityText: "Noteringar, bokningar och kundhistorik",
    workspaceText: "Kundportal, leads och bokningar samlade",
    workspaceLimitedText: "Leads, CRM och bokningar är inte aktiverade för arbetsytan",
    overviewLabel: "Dashboardöversikt",
    shortcuts: "Snabbvägar",
    availableParts: "Tillgängliga delar",
    continueWork: "Fortsätt där arbetet händer",
    availableText: "Här visas bara delar som är tillgängliga för din roll och arbetsyta.",
    continueText: "Öppna rätt del av kundflödet utan att tappa fokus.",
    todayFocus: "Dagens fokus",
    access: "Åtkomst",
    nextStep: "Nästa steg",
    followBookings: "Följ bokningarna",
    confirmedOf: (confirmed: number, total: number) => `${confirmed} bekräftade av ${total}`,
    nurtureCustomers: "Vårda kundrelationerna",
    activeOf: (active: number, total: number) => `${active} aktiva av ${total}`,
    registerCustomer: "Registrera nästa kund",
    createProfile: "Skapa en komplett kundprofil",
    limitedAccess: "Din arbetsyta har begränsad åtkomst. Kontakta Owner eller Proffera för att aktivera Leads, CRM och bokningar.",
  },
  en: {
    quickLinks: [
      { title: "Leads", text: "Prioritise new enquiries and see which contacts need the first action.", href: "/dashboard/leads", icon: UserRoundSearch, label: "Enquiries", featureKey: "lead_inbox" },
      { title: "Customers", text: "Open the customer list, review history and manage relationships over time.", href: "/dashboard/kunder", icon: UsersRound, label: "CRM", moduleId: "customer_crm" },
      { title: "Bookings", text: "Review upcoming bookings, their status and the next step in the customer flow.", href: "/dashboard/bokningar", icon: CalendarCheck2, label: "Planning", moduleId: "online_booking" },
      { title: "AI assistant", text: "See how AI can capture questions, qualify needs and forward clear leads.", href: "/dashboard/ai-assistent", icon: Bot, label: "Planned module" },
      { title: "Settings", text: "Manage the business profile, contact details, services and AI information.", href: "/dashboard/installningar", icon: Settings, label: "Configuration" },
    ],
    activeBadge: "Workspace active",
    limitedHeading: "Your workspace is ready when its modules are enabled.",
    heading: "Full control of every customer relationship.",
    limitedIntro: "CRM and bookings are not enabled for this workspace. Contact the owner or Proffera for assistance.",
    intro: "Prioritise new enquiries, follow bookings and keep customer work moving from one overview.",
    manageLeads: "Manage leads",
    newBooking: "New booking",
    customers: "Customers",
    bookings: "Bookings",
    activity: "Activity",
    workspace: "Workspace",
    active: "Active",
    customerSingular: "customer",
    customerPlural: "customers",
    activeSingular: "active",
    activePlural: "active",
    bookingSingular: "booking",
    bookingPlural: "bookings",
    confirmedSingular: "confirmed",
    confirmedPlural: "confirmed",
    activityText: "Notes, bookings and customer history",
    workspaceText: "Customer portal, leads and bookings in one place",
    workspaceLimitedText: "Leads, CRM and bookings are not enabled for this workspace",
    overviewLabel: "Dashboard overview",
    shortcuts: "Shortcuts",
    availableParts: "Available areas",
    continueWork: "Continue where the work happens",
    availableText: "Only areas available to your role and workspace are shown here.",
    continueText: "Open the right part of the customer flow without losing focus.",
    todayFocus: "Today’s focus",
    access: "Access",
    nextStep: "Next step",
    followBookings: "Review bookings",
    confirmedOf: (confirmed: number, total: number) => `${confirmed} confirmed of ${total}`,
    nurtureCustomers: "Manage customer relationships",
    activeOf: (active: number, total: number) => `${active} active of ${total}`,
    registerCustomer: "Add the next customer",
    createProfile: "Create a complete customer profile",
    limitedAccess: "Your workspace has limited access. Contact the owner or Proffera to enable Leads, CRM and bookings.",
  },
} as const;

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const locale: DashboardLocale = first(params?.lang) === "en" ? "en" : "sv";
  const text = copy[locale];
  const [moduleAccess, enabledFeatures, workspaceAccess] = await Promise.all([
    getDashboardModuleAccess(),
    getDashboardEnabledFeatureKeys(),
    getUserWorkspaceAccess(),
  ]);
  const isModuleEnabled = (id: "customer_crm" | "online_booking") => moduleAccess.some((module) => module.id === id && module.isEnabled);
  const canUseCrm = isModuleEnabled("customer_crm");
  const canUseBooking = isModuleEnabled("online_booking");
  const canUseLeads = enabledFeatures.includes("lead_inbox");
  const hasLimitedAccess = !canUseCrm && !canUseBooking && !canUseLeads;
  const stats = await getDashboardStats({ includeCustomers: canUseCrm, includeBookings: canUseBooking });
  const visibleQuickLinks = text.quickLinks.filter((item) =>
    (!("moduleId" in item) || !item.moduleId || isModuleEnabled(item.moduleId))
    && (!("featureKey" in item) || enabledFeatures.includes(item.featureKey))
    && (item.href !== "/dashboard/installningar" || canManageWorkspaceSettings(workspaceAccess)),
  );

  const overviewStats = [
    ...(canUseCrm ? [{ label: text.customers, value: String(stats.customersCount), text: `${countLabel(stats.customersCount, text.customerSingular, text.customerPlural)} · ${countLabel(stats.activeCustomersCount, text.activeSingular, text.activePlural)}`, icon: UsersRound, tone: "bg-brand-soft text-brand" }] : []),
    ...(canUseBooking ? [{ label: text.bookings, value: String(stats.bookingsCount), text: `${countLabel(stats.bookingsCount, text.bookingSingular, text.bookingPlural)} · ${countLabel(stats.confirmedBookingsCount, text.confirmedSingular, text.confirmedPlural)}`, icon: CalendarCheck2, tone: "border border-line bg-surface-subtle text-ink-muted" }] : []),
    ...(canUseCrm ? [{ label: text.activity, value: String(stats.customerEventsCount), text: text.activityText, icon: Activity, tone: "bg-accent-soft/25 text-brand-deep" }] : []),
    { label: text.workspace, value: text.active, text: canUseCrm || canUseBooking || canUseLeads ? text.workspaceText : text.workspaceLimitedText, icon: ShieldCheck, tone: "border border-line bg-canvas text-ink-muted" },
  ];

  return (
    <div className="grid gap-6 lg:gap-7" lang={locale}>
      <section className="relative overflow-hidden rounded-panel bg-brand-deep px-6 py-8 text-white shadow-lift sm:px-8 lg:px-10 lg:py-10">
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-accent-soft/15 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-8 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white/75"><span className="h-2 w-2 rounded-full bg-white/70" />{text.activeBadge}</div>
            <h2 className="mt-5 max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl lg:text-[44px] lg:leading-[1.08]">{hasLimitedAccess ? text.limitedHeading : text.heading}</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">{hasLimitedAccess ? text.limitedIntro : text.intro}</p>
          </div>
          {canUseLeads || canUseBooking ? <div className="flex flex-col gap-3 sm:flex-row">
            {canUseLeads ? <Link href={withLocale("/dashboard/leads", locale)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-surface px-4 py-2.5 text-sm font-bold text-brand-deep transition hover:-translate-y-0.5">{text.manageLeads}<ArrowRight className="h-4 w-4" /></Link> : null}
            {canUseBooking ? <Link href={withLocale("/dashboard/bokningar/ny", locale)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"><CalendarPlus className="h-4 w-4" />{text.newBooking}</Link> : null}
          </div> : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={text.overviewLabel}>
        {overviewStats.map((item) => <article key={item.label} className="rounded-card border border-line bg-surface p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-line-strong">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">{item.label}</p><p className="mt-3 text-3xl font-bold text-brand-deep">{item.value}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-control ${item.tone}`}><item.icon className="h-5 w-5" /></span></div>
          <p className="mt-3 text-sm leading-6 text-ink-muted">{item.text}</p>
        </article>)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)]">
        <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{text.shortcuts}</p><h3 className="mt-2 text-xl font-bold text-ink">{hasLimitedAccess ? text.availableParts : text.continueWork}</h3></div><p className="max-w-md text-sm leading-6 text-ink-muted">{hasLimitedAccess ? text.availableText : text.continueText}</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{visibleQuickLinks.map((item) => <Link key={item.href} href={withLocale(item.href, locale)} className="group flex gap-4 rounded-card border border-transparent bg-surface-subtle p-4 transition hover:border-line hover:bg-brand-tint"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface text-brand shadow-card"><item.icon className="h-[18px] w-[18px]" /></span><span className="min-w-0 flex-1"><span className="flex justify-between gap-3"><span className="font-bold text-ink">{item.title}</span><ArrowRight className="h-4 w-4 text-brand" /></span><span className="mt-1 block text-xs font-bold uppercase tracking-wide text-ink-muted">{item.label}</span><span className="mt-2 block text-sm leading-6 text-ink-muted">{item.text}</span></span></Link>)}</div>
        </div>

        <aside className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{text.todayFocus}</p><h3 className="mt-2 text-xl font-bold text-ink">{hasLimitedAccess ? text.access : text.nextStep}</h3></div><span className="flex h-10 w-10 items-center justify-center rounded-control bg-brand-soft text-brand"><CheckCircle2 className="h-5 w-5" /></span></div>
          <div className="mt-5 grid gap-2">
            {canUseBooking ? <Link href={withLocale("/dashboard/bokningar", locale)} className="flex items-start gap-3 rounded-control p-3 transition hover:bg-surface-subtle"><CalendarCheck2 className="mt-1 h-5 w-5 text-ink-muted" /><span><span className="block text-sm font-bold text-ink">{text.followBookings}</span><span className="text-sm text-ink-muted">{text.confirmedOf(stats.confirmedBookingsCount, stats.bookingsCount)}</span></span></Link> : null}
            {canUseCrm ? <><Link href={withLocale("/dashboard/kunder", locale)} className="flex items-start gap-3 rounded-control p-3 transition hover:bg-surface-subtle"><CircleUserRound className="mt-1 h-5 w-5 text-brand" /><span><span className="block text-sm font-bold text-ink">{text.nurtureCustomers}</span><span className="text-sm text-ink-muted">{text.activeOf(stats.activeCustomersCount, stats.customersCount)}</span></span></Link><Link href={withLocale("/dashboard/kunder/ny", locale)} className="flex items-start gap-3 rounded-control p-3 transition hover:bg-surface-subtle"><UserRoundPlus className="mt-1 h-5 w-5 text-brand-deep" /><span><span className="block text-sm font-bold text-ink">{text.registerCustomer}</span><span className="text-sm text-ink-muted">{text.createProfile}</span></span></Link></> : null}
            {hasLimitedAccess ? <p className="rounded-control bg-surface-subtle p-4 text-sm leading-6 text-ink-muted">{text.limitedAccess}</p> : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
