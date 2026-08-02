import Link from "next/link";
import { FileText, Inbox, MapPin, UserRound } from "lucide-react";

import { DashboardDataPanel, DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardWorkspaceQuoteRequests } from "@/lib/workspace-quote-requests-db";
import type { WorkspaceQuoteStatus } from "@/lib/workspace-quote-policy";

export const dynamic = "force-dynamic";

type DashboardLocale = "sv" | "en";

const statusTone: Record<WorkspaceQuoteStatus, string> = {
  submitted: "bg-[#eaf2ec] text-[#17452f]",
  reviewing: "bg-[#edf0f8] text-[#405582]",
  quoted: "bg-[#f8f0df] text-[#8a6722]",
  accepted: "bg-[#e4f4e8] text-[#1f6a3d]",
  rejected: "bg-[#f7e9e7] text-[#8b3f35]",
  cancelled: "bg-[#eceeed] text-[#5d665f]",
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
  const quotes = await getDashboardWorkspaceQuoteRequests();
  const active = quotes.filter((quote) => !["accepted", "rejected", "cancelled"].includes(quote.status)).length;
  const metrics = [
    { label: text.active, value: String(active), helper: text.all, icon: Inbox, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: text.submitted, value: String(quotes.filter((quote) => quote.status === "submitted").length), helper: text.active, icon: UserRound, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: text.reviewing, value: String(quotes.filter((quote) => quote.status === "reviewing").length), helper: text.active, icon: FileText, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: text.quoted, value: String(quotes.filter((quote) => quote.status === "quoted").length), helper: text.active, icon: MapPin, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ];

  return (
    <div className="grid gap-6" lang={locale}>
      <DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} icon={FileText} />
      <DashboardMetricGrid items={metrics} />
      <DashboardDataPanel title={text.all} description={text.description} count={quotes.length}>
        {quotes.length === 0 ? (
          <div className="p-5 sm:p-6"><div className="rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] px-5 py-8 text-center text-sm text-[#667168]">{text.empty}</div></div>
        ) : (
          <>
            <div className="hidden grid-cols-[0.8fr_1.2fr_1fr_1fr_0.9fr_1fr_0.7fr] gap-4 border-b border-[#e5e9e2] bg-[#f7f9f6] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#778179] xl:grid">
              <span>Ref</span><span>{text.customer}</span><span>{text.service}</span><span>{text.location}</span><span>{text.status}</span><span>{text.received}</span><span>{text.action}</span>
            </div>
            {quotes.map((quote) => (
              <div key={quote.id} className="mx-3 my-3 grid gap-3 rounded-2xl border border-[#e2e7df] bg-white p-4 text-sm text-[#435047] shadow-sm xl:mx-0 xl:my-0 xl:grid-cols-[0.8fr_1.2fr_1fr_1fr_0.9fr_1fr_0.7fr] xl:items-center xl:gap-4 xl:rounded-none xl:border-x-0 xl:border-t-0 xl:px-6 xl:py-4 xl:shadow-none">
                <p className="font-semibold text-[#17201a]">{quote.referenceId}</p>
                <p className="font-semibold text-[#17201a]">{quote.customerName}</p>
                <p>{quote.serviceName || text.noService}</p>
                <p>{[quote.postalCode, quote.city].filter(Boolean).join(" ") || text.noLocation}</p>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusTone[quote.status]}`}>{statusLabel[locale][quote.status]}</span>
                <p>{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(quote.createdAt))}</p>
                <Link href={localHref(`/dashboard/offerter/${quote.id}`, locale)} className="inline-flex min-h-9 w-fit items-center justify-center rounded-lg bg-[#173e2b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0f3020]">{text.open}</Link>
              </div>
            ))}
          </>
        )}
      </DashboardDataPanel>
    </div>
  );
}
