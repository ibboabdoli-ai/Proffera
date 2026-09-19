import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Inbox, MapPin, UserRound } from "lucide-react";

import { DashboardDataPanel, DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";
import { getDashboardWorkspaceQuoteRequests } from "@/lib/workspace-quote-requests-db";
import type { WorkspaceQuoteStatus } from "@/lib/workspace-quote-policy";

export const dynamic = "force-dynamic";

type DashboardLocale = "sv" | "en";

const statusTone: Record<WorkspaceQuoteStatus, string> = {
  submitted: "bg-[#eef5ff] text-[#1469d8]",
  reviewing: "bg-[#eef5ff] text-[#0a2e63]",
  quoted: "bg-[#fff7df] text-[#805d14]",
  accepted: "bg-[#eaf8f2] text-[#087754]",
  rejected: "bg-danger/10 text-danger",
  cancelled: "bg-surface-subtle text-ink-muted",
};

const copy = {
  sv: {
    eyebrow: "Offerter",
    title: "Förfrågningar om offert",
    description: "Se inkommande offertförfrågningar och följ varje ärende från inskickat till accepterat eller avslutat.",
    active: "Aktiva",
    submitted: "Nya",
    reviewing: "Under granskning",
    quoted: "Offert skickad",
    all: "Alla förfrågningar",
    empty: "Inga offertförfrågningar har kommit in ännu.",
    customer: "Kund",
    service: "Tjänst",
    location: "Ort",
    status: "Status",
    received: "Inkommen",
    action: "Åtgärd",
    open: "Öppna",
    noService: "Ej vald",
    noLocation: "Ej angivet",
  },
  en: {
    eyebrow: "Quotes",
    title: "Quote enquiries",
    description: "Review incoming quote enquiries and follow each request from submission to acceptance or closure.",
    active: "Active",
    submitted: "New",
    reviewing: "Reviewing",
    quoted: "Quote sent",
    all: "All enquiries",
    empty: "No quote enquiries have been received yet.",
    customer: "Customer",
    service: "Service",
    location: "Location",
    status: "Status",
    received: "Received",
    action: "Action",
    open: "Open",
    noService: "Not selected",
    noLocation: "Not provided",
  },
} as const;

const statusLabel: Record<DashboardLocale, Record<WorkspaceQuoteStatus, string>> = {
  sv: { submitted: "Ny", reviewing: "Granskas", quoted: "Offert skickad", accepted: "Accepterad", rejected: "Avslagen", cancelled: "Avbruten" },
  en: { submitted: "New", reviewing: "Reviewing", quoted: "Quote sent", accepted: "Accepted", rejected: "Rejected", cancelled: "Cancelled" },
};

function localHref(href: string, locale: DashboardLocale) {
  return locale === "en" ? `${href}?lang=en` : href;
}

export default async function QuoteInboxPage({ searchParams }: { searchParams?: Promise<{ lang?: string | string[] }> }) {
  const params = searchParams ? await searchParams : undefined;
  const language = Array.isArray(params?.lang) ? params.lang[0] : params?.lang;
  const locale: DashboardLocale = language === "en" ? "en" : "sv";
  const text = copy[locale];
  const access = await getUserWorkspaceAccess();
  if (!access.ok) redirect(access.reason === "no_session" ? "/logga-in" : "/dashboard");

  const quotes = await getDashboardWorkspaceQuoteRequests();
  const active = quotes.filter((quote) => !["accepted", "rejected", "cancelled"].includes(quote.status)).length;
  const metrics = [
    { label: text.active, value: String(active), helper: text.all, icon: Inbox, tone: "bg-[#eef5ff] text-[#1469d8]" },
    { label: text.submitted, value: String(quotes.filter((quote) => quote.status === "submitted").length), helper: text.active, icon: UserRound, tone: "bg-[#eef5ff] text-[#0a2e63]" },
    { label: text.reviewing, value: String(quotes.filter((quote) => quote.status === "reviewing").length), helper: text.active, icon: FileText, tone: "bg-[#fff7df] text-[#805d14]" },
    { label: text.quoted, value: String(quotes.filter((quote) => quote.status === "quoted").length), helper: text.active, icon: MapPin, tone: "bg-surface-subtle text-brand-deep" },
  ];

  return (
    <div className="grid gap-6" lang={locale}>
      <DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} icon={FileText} />
      <DashboardMetricGrid items={metrics} />

      <DashboardDataPanel title={text.all} description={text.description} count={quotes.length}>
        {quotes.length === 0 ? (
          <div className="p-5 sm:p-6">
            <div className="rounded-card border border-dashed border-line-strong bg-surface-subtle px-5 py-8 text-center text-sm text-ink-muted">
              {text.empty}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[0.8fr_1.2fr_1fr_1fr_0.9fr_1fr_0.7fr] gap-4 border-b border-line bg-surface-subtle px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted xl:grid">
              <span>Ref</span><span>{text.customer}</span><span>{text.service}</span><span>{text.location}</span><span>{text.status}</span><span>{text.received}</span><span>{text.action}</span>
            </div>

            {quotes.map((quote) => (
              <div key={quote.id} className="mx-3 my-3 grid gap-3 rounded-card border border-line bg-surface p-4 text-sm text-ink-muted shadow-card xl:mx-0 xl:my-0 xl:grid-cols-[0.8fr_1.2fr_1fr_1fr_0.9fr_1fr_0.7fr] xl:items-center xl:gap-4 xl:rounded-none xl:border-x-0 xl:border-t-0 xl:px-6 xl:py-4 xl:shadow-none">
                <p className="font-semibold text-ink">{quote.referenceId}</p>
                <p className="font-semibold text-ink">{quote.customerName}</p>
                <p>{quote.serviceName || text.noService}</p>
                <p>{[quote.postalCode, quote.city].filter(Boolean).join(" ") || text.noLocation}</p>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusTone[quote.status]}`}>{statusLabel[locale][quote.status]}</span>
                <p>{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(quote.createdAt))}</p>
                <Link href={localHref(`/dashboard/offerter/${quote.id}`, locale)} className="inline-flex min-h-9 w-fit items-center justify-center rounded-control bg-brand-deep px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-hover">{text.open}</Link>
              </div>
            ))}
          </>
        )}
      </DashboardDataPanel>
    </div>
  );
}
