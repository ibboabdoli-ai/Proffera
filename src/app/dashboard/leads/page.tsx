import Link from "next/link";
import { Bot, CalendarPlus, LayoutList, UserRoundPlus, UserRoundSearch } from "lucide-react";

import { DashboardDataPanel, DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardLeads, type DashboardLead } from "@/lib/dashboard-leads";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

export const dynamic = "force-dynamic";

type LeadStatus = DashboardLead["status"];
type DashboardLocale = "sv" | "en";

const statusStyles: Record<LeadStatus, string> = {
  Ny: "bg-brand-soft text-brand",
};

const copy = {
  sv: {
    title: "Hantera nya kundförfrågningar",
    descriptionCrm: "Samla inkommande förfrågningar, prioritera nästa kontakt och konvertera intresset till kund eller bokning.",
    descriptionBasic: "Samla inkommande förfrågningar och prioritera nästa kontakt. Kundprofiler och full CRM-historik ingår i Professional.",
    newCustomer: "Ny kund",
    newBooking: "Ny bokning",
    activeRequests: "Aktiva förfrågningar",
    panelCrm: "Prioriterad arbetslista med prospekt från kundregistret.",
    panelBasic: "Prioriterad arbetslista med inkommande förfrågningar.",
    emptyCrm: "Inga aktiva leads hittades. Skapa en kund med status Prospekt så visas den här.",
    emptyBasic: "Inga aktiva leads hittades. Nya förfrågningar visas här när de kommer in.",
    columns: { customer: "Kund", service: "Tjänst", city: "Ort", status: "Status", source: "Källa", value: "Värde", next: "Nästa steg", action: "Åtgärd" },
    viewProfile: "Visa profil",
    booking: "Bokning",
    newStatus: "Ny",
    aiSource: "AI-chatt",
    metrics: {
      newLeads: "Nya leads",
      newLeadsHelp: "Prospekt som behöver uppföljning",
      aiChat: "AI-chatt",
      aiChatHelp: "Inkomna från AI-dialogen",
      dashboard: "Dashboard",
      dashboardHelp: "Manuellt skapade prospekt",
      bookingSuggested: "Bokning föreslagen",
      bookingSuggestedHelp: "Redo för kommande bokningssteg",
    },
  },
  en: {
    title: "Manage new customer enquiries",
    descriptionCrm: "Collect incoming enquiries, prioritise the next contact and convert interest into a customer or booking.",
    descriptionBasic: "Collect incoming enquiries and prioritise the next contact. Customer profiles and full CRM history are included in Professional.",
    newCustomer: "New customer",
    newBooking: "New booking",
    activeRequests: "Active enquiries",
    panelCrm: "A prioritised worklist of prospects from the customer register.",
    panelBasic: "A prioritised worklist of incoming enquiries.",
    emptyCrm: "No active leads were found. Create a customer with Prospect status to show it here.",
    emptyBasic: "No active leads were found. New enquiries will appear here when they arrive.",
    columns: { customer: "Customer", service: "Service", city: "City", status: "Status", source: "Source", value: "Value", next: "Next step", action: "Action" },
    viewProfile: "View profile",
    booking: "Booking",
    newStatus: "New",
    aiSource: "AI chat",
    metrics: {
      newLeads: "New leads",
      newLeadsHelp: "Prospects requiring follow-up",
      aiChat: "AI chat",
      aiChatHelp: "Received from AI conversations",
      dashboard: "Dashboard",
      dashboardHelp: "Manually created prospects",
      bookingSuggested: "Booking suggested",
      bookingSuggestedHelp: "Ready for the next booking step",
    },
  },
} as const;

function localizedHref(href: string, locale: DashboardLocale) {
  return locale === "en" ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

function getLeadStats(leads: DashboardLead[], locale: DashboardLocale) {
  const text = copy[locale].metrics;
  const aiChatLeads = leads.filter((lead) => lead.source === "AI-chatt").length;
  const dashboardLeads = leads.filter((lead) => lead.source === "Dashboard").length;

  return [
    { label: text.newLeads, value: String(leads.length), helper: text.newLeadsHelp, icon: UserRoundSearch, tone: "bg-brand-soft text-brand" },
    { label: text.aiChat, value: String(aiChatLeads), helper: text.aiChatHelp, icon: Bot, tone: "border border-line bg-surface-subtle text-ink-muted" },
    { label: text.dashboard, value: String(dashboardLeads), helper: text.dashboardHelp, icon: LayoutList, tone: "bg-accent-soft/25 text-brand-deep" },
    { label: text.bookingSuggested, value: "0", helper: text.bookingSuggestedHelp, icon: CalendarPlus, tone: "border border-line bg-canvas text-ink-muted" },
  ];
}

export default async function LeadsPage({ searchParams }: { searchParams?: Promise<{ lang?: string | string[] }> }) {
  const params = searchParams ? await searchParams : undefined;
  const langValue = Array.isArray(params?.lang) ? params?.lang[0] : params?.lang;
  const locale: DashboardLocale = langValue === "en" ? "en" : "sv";
  const text = copy[locale];

  const [leads, canUseCrm, canUseBooking] = await Promise.all([
    getDashboardLeads(),
    hasDashboardModuleAccess("customer_crm"),
    hasDashboardModuleAccess("online_booking"),
  ]);
  const stats = getLeadStats(leads, locale);

  return (
    <div className="grid gap-6" lang={locale === "en" ? "en" : "sv"}>
      <DashboardPageHeader
        eyebrow="Leads"
        title={text.title}
        description={canUseCrm ? text.descriptionCrm : text.descriptionBasic}
        icon={UserRoundSearch}
        actions={
          <>
            {canUseCrm ? <Link href={localizedHref("/dashboard/kunder/ny", locale)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand-deep px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-brand-hover">
              <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
              {text.newCustomer}
            </Link> : null}
            {canUseBooking ? <Link href={localizedHref("/dashboard/bokningar/ny", locale)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-bold text-brand transition hover:-translate-y-0.5 hover:bg-brand-tint">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              {text.newBooking}
            </Link> : null}
          </>
        }
      />

      <DashboardMetricGrid items={stats} />

      <DashboardDataPanel title={text.activeRequests} description={canUseCrm ? text.panelCrm : text.panelBasic} count={leads.length}>
        {leads.length === 0 ? (
          <div className="p-5 sm:p-6"><div className="rounded-card border border-dashed border-line-strong bg-surface-subtle px-5 py-8 text-center text-sm leading-7 text-ink-muted">{canUseCrm ? text.emptyCrm : text.emptyBasic}</div></div>
        ) : (
          <>
            <div className="hidden grid-cols-[0.7fr_1.2fr_1fr_0.8fr_0.7fr_0.8fr_0.7fr_1fr_1.4fr] gap-4 border-b border-line bg-surface-subtle px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted xl:grid">
              <span>Ref</span><span>{text.columns.customer}</span><span>{text.columns.service}</span><span>{text.columns.city}</span><span>{text.columns.status}</span><span>{text.columns.source}</span><span>{text.columns.value}</span><span>{text.columns.next}</span><span>{text.columns.action}</span>
            </div>

            {leads.map((lead) => (
              <div key={lead.id} className="mx-3 my-3 grid gap-3 rounded-card border border-line bg-surface p-4 text-sm text-ink-muted shadow-card last:border-b xl:mx-0 xl:my-0 xl:grid-cols-[0.7fr_1.2fr_1fr_0.8fr_0.7fr_0.8fr_0.7fr_1fr_1.4fr] xl:items-center xl:gap-4 xl:rounded-none xl:border-x-0 xl:border-t-0 xl:px-6 xl:py-4 xl:shadow-none xl:last:border-b-0">
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted xl:hidden">Ref</p><p className="font-semibold text-ink">{lead.ref}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted xl:hidden">{text.columns.customer}</p><p className="font-semibold text-ink">{lead.customer}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted xl:hidden">{text.columns.service}</p><p>{lead.service}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted xl:hidden">{text.columns.city}</p><p>{lead.city}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted xl:hidden">{text.columns.status}</p><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[lead.status]}`}>{locale === "en" && lead.status === "Ny" ? text.newStatus : lead.status}</span></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted xl:hidden">{text.columns.source}</p><p>{locale === "en" && lead.source === "AI-chatt" ? text.aiSource : lead.source}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted xl:hidden">{text.columns.value}</p><p>{lead.value}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted xl:hidden">{text.columns.next}</p><p className="font-semibold text-brand">{lead.nextStep}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted xl:hidden">{text.columns.action}</p><div className="flex flex-wrap gap-2">
                  {canUseCrm ? <Link href={localizedHref(lead.profileHref, locale)} className="inline-flex min-h-9 items-center justify-center rounded-control bg-brand-deep px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-hover">{text.viewProfile}</Link> : null}
                  {canUseBooking ? <Link href={localizedHref(lead.bookingHref, locale)} className="inline-flex min-h-9 items-center justify-center rounded-control border border-line bg-surface px-3 py-2 text-xs font-bold text-brand transition hover:bg-brand-tint">{text.booking}</Link> : null}
                </div></div>
              </div>
            ))}
          </>
        )}
      </DashboardDataPanel>
    </div>
  );
}
