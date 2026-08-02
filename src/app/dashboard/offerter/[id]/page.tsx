import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardWorkspaceQuoteRequest, transitionDashboardWorkspaceQuoteRequest } from "@/lib/workspace-quote-requests-db";
import { getWorkspaceQuoteTransitions, isWorkspaceQuoteStatus, type WorkspaceQuoteStatus } from "@/lib/workspace-quote-policy";

export const dynamic = "force-dynamic";

type DashboardLocale = "sv" | "en";

const statusLabel: Record<DashboardLocale, Record<WorkspaceQuoteStatus, string>> = {
  sv: { submitted: "Ny", reviewing: "Granskas", quoted: "Offert skickad", accepted: "Accepterad", rejected: "Avslagen", cancelled: "Avbruten" },
  en: { submitted: "New", reviewing: "Reviewing", quoted: "Quote sent", accepted: "Accepted", rejected: "Rejected", cancelled: "Cancelled" },
};

const copy = {
  sv: {
    back: "Till offertförfrågningar",
    eyebrow: "Offertförfrågan",
    customer: "Kunduppgifter",
    request: "Förfrågan",
    service: "Tjänst",
    preferredDate: "Önskat datum",
    submitted: "Inkommen",
    source: "Källa",
    description: "Beskrivning",
    noService: "Ingen tjänst vald",
    noDate: "Inget datum angivet",
    noPhone: "Inget telefonnummer",
    noLocation: "Ingen ort angiven",
    changeStatus: "Ändra status",
    currentStatus: "Nuvarande status",
  },
  en: {
    back: "Back to quote enquiries",
    eyebrow: "Quote enquiry",
    customer: "Customer details",
    request: "Request",
    service: "Service",
    preferredDate: "Preferred date",
    submitted: "Received",
    source: "Source",
    description: "Description",
    noService: "No service selected",
    noDate: "No date provided",
    noPhone: "No phone number",
    noLocation: "No location provided",
    changeStatus: "Change status",
    currentStatus: "Current status",
  },
} as const;

function localHref(href: string, locale: DashboardLocale) {
  return locale === "en" ? `${href}?lang=en` : href;
}

export default async function QuoteDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ lang?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const language = Array.isArray(query?.lang) ? query.lang[0] : query?.lang;
  const locale: DashboardLocale = language === "en" ? "en" : "sv";
  const text = copy[locale];
  const foundQuote = await getDashboardWorkspaceQuoteRequest(id);
  if (!foundQuote) notFound();
  const quote = foundQuote;
  const nextStatuses = getWorkspaceQuoteTransitions(quote.status);

  async function changeStatus(formData: FormData) {
    "use server";
    const value = formData.get("status");
    if (!isWorkspaceQuoteStatus(value)) return;
    if (!getWorkspaceQuoteTransitions(quote.status).includes(value)) return;
    await transitionDashboardWorkspaceQuoteRequest(quote.id, value);
    redirect(localHref(`/dashboard/offerter/${quote.id}`, locale));
  }

  const location = [quote.postalCode, quote.city].filter(Boolean).join(" ");

  return (
    <div className="grid gap-6" lang={locale}>
      <Link href={localHref("/dashboard/offerter", locale)} className="inline-flex w-fit items-center gap-2 text-sm font-bold text-[#17452f]"><ArrowLeft className="h-4 w-4" />{text.back}</Link>
      <DashboardPageHeader eyebrow={text.eyebrow} title={quote.referenceId} description={`${text.currentStatus}: ${statusLabel[locale][quote.status]}`} icon={FileText} />

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-3xl border border-[#e0e6de] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[#17201a]">{text.customer}</h2>
          <div className="mt-5 grid gap-4 text-sm">
            <div className="flex items-start gap-3"><UserRound className="mt-0.5 h-5 w-5 text-[#557061]" /><div><p className="text-xs font-bold uppercase tracking-wide text-[#7d877f]">{text.customer}</p><p className="mt-1 font-semibold text-[#17201a]">{quote.customerName}</p></div></div>
            <div className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-[#557061]" /><a className="font-semibold text-[#17452f]" href={`mailto:${quote.customerEmail}`}>{quote.customerEmail}</a></div>
            <div className="flex items-start gap-3"><Phone className="mt-0.5 h-5 w-5 text-[#557061]" /><p>{quote.customerPhone || text.noPhone}</p></div>
            <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-[#557061]" /><p>{location || text.noLocation}</p></div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#e0e6de] bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-[#17201a]">{text.request}</h2>
          <dl className="mt-5 grid gap-4 text-sm">
            <div><dt className="text-xs font-bold uppercase tracking-wide text-[#7d877f]">{text.service}</dt><dd className="mt-1 font-semibold text-[#17201a]">{quote.serviceName || text.noService}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-[#7d877f]">{text.preferredDate}</dt><dd className="mt-1">{quote.preferredDate || text.noDate}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-[#7d877f]">{text.submitted}</dt><dd className="mt-1">{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "long", timeStyle: "short" }).format(new Date(quote.createdAt))}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-[#7d877f]">{text.source}</dt><dd className="mt-1">{quote.source}</dd></div>
          </dl>
        </section>
      </div>

      <section className="rounded-3xl border border-[#e0e6de] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#557061]" /><h2 className="text-lg font-bold text-[#17201a]">{text.description}</h2></div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#435047]">{quote.description}</p>
      </section>

      {nextStatuses.length > 0 ? (
        <section className="rounded-3xl border border-[#dbe3d8] bg-[#f7f9f6] p-5 sm:p-6">
          <h2 className="text-lg font-bold text-[#17201a]">{text.changeStatus}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {nextStatuses.map((status: WorkspaceQuoteStatus) => (
              <form key={status} action={changeStatus}>
                <input type="hidden" name="status" value={status} />
                <button type="submit" className="min-h-11 rounded-xl bg-[#173e2b] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#0f3020]">{statusLabel[locale][status]}</button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
