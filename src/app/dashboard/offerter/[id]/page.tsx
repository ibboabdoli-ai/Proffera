import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, Mail, MapPin, Phone, ReceiptText, UserRound } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import {
  createDashboardWorkspaceQuoteOfferDraft,
  getDashboardWorkspaceBillingCurrency,
  getDashboardWorkspaceQuoteOffers,
} from "@/lib/workspace-quote-offers-db";
import { validateWorkspaceQuoteOfferDraft } from "@/lib/workspace-quote-offer-draft";
import { getDashboardWorkspaceQuoteRequest, transitionDashboardWorkspaceQuoteRequest } from "@/lib/workspace-quote-requests-db";
import { getWorkspaceQuoteTransitions, isWorkspaceQuoteStatus, type WorkspaceQuoteStatus } from "@/lib/workspace-quote-policy";

export const dynamic = "force-dynamic";

type DashboardLocale = "sv" | "en";

const statusLabel: Record<DashboardLocale, Record<WorkspaceQuoteStatus, string>> = {
  sv: { submitted: "Ny", reviewing: "Granskas", quoted: "Offert skickad", accepted: "Accepterad", rejected: "Avslagen", cancelled: "Avbruten" },
  en: { submitted: "New", reviewing: "Reviewing", quoted: "Quote sent", accepted: "Accepted", rejected: "Rejected", cancelled: "Cancelled" },
};

const offerStatusLabel = {
  sv: { draft: "Utkast", sent: "Skickad", accepted: "Accepterad", rejected: "Avslagen", expired: "Utgången", void: "Makulerad" },
  en: { draft: "Draft", sent: "Sent", accepted: "Accepted", rejected: "Rejected", expired: "Expired", void: "Void" },
} as const;

const copy = {
  sv: {
    back: "Till offertförfrågningar", eyebrow: "Offertförfrågan", customer: "Kunduppgifter", request: "Förfrågan",
    service: "Tjänst", preferredDate: "Önskat datum", submitted: "Inkommen", source: "Källa", description: "Beskrivning",
    noService: "Ingen tjänst vald", noDate: "Inget datum angivet", noPhone: "Inget telefonnummer", noLocation: "Ingen ort angiven",
    changeStatus: "Ändra status", currentStatus: "Nuvarande status", offers: "Offerter", createOffer: "Skapa offertutkast",
    offerTitle: "Rubrik", amount: "Belopp exkl. moms", vatRate: "Moms (%)", validUntil: "Giltig till", terms: "Villkor",
    saveDraft: "Spara utkast", noOffers: "Ingen offert har skapats ännu.", version: "Version", subtotal: "Exkl. moms",
    vat: "Moms", total: "Totalt", invalid: "Kontrollera offertens belopp, moms, rubrik och datum.", created: "Offertutkastet skapades.",
  },
  en: {
    back: "Back to quote enquiries", eyebrow: "Quote enquiry", customer: "Customer details", request: "Request",
    service: "Service", preferredDate: "Preferred date", submitted: "Received", source: "Source", description: "Description",
    noService: "No service selected", noDate: "No date provided", noPhone: "No phone number", noLocation: "No location provided",
    changeStatus: "Change status", currentStatus: "Current status", offers: "Offers", createOffer: "Create offer draft",
    offerTitle: "Title", amount: "Amount excluding VAT", vatRate: "VAT (%)", validUntil: "Valid until", terms: "Terms",
    saveDraft: "Save draft", noOffers: "No offer has been created yet.", version: "Version", subtotal: "Excluding VAT",
    vat: "VAT", total: "Total", invalid: "Check the offer amount, VAT, title and date.", created: "The offer draft was created.",
  },
} as const;

function localHref(href: string, locale: DashboardLocale, extra?: Record<string, string>) {
  const query = new URLSearchParams();
  if (locale === "en") query.set("lang", "en");
  for (const [key, value] of Object.entries(extra ?? {})) query.set(key, value);
  const suffix = query.toString();
  return suffix ? `${href}?${suffix}` : href;
}

function formatMoney(amountMinor: number, currency: string, locale: DashboardLocale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency", currency, minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export default async function QuoteDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lang?: string | string[]; offer?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const language = Array.isArray(query?.lang) ? query.lang[0] : query?.lang;
  const offerMessage = Array.isArray(query?.offer) ? query.offer[0] : query?.offer;
  const locale: DashboardLocale = language === "en" ? "en" : "sv";
  const text = copy[locale];
  const foundQuote = await getDashboardWorkspaceQuoteRequest(id);
  if (!foundQuote) notFound();
  const quote = foundQuote;
  const [offers, currency] = await Promise.all([
    getDashboardWorkspaceQuoteOffers(quote.id),
    getDashboardWorkspaceBillingCurrency(),
  ]);
  const nextStatuses = getWorkspaceQuoteTransitions(quote.status);

  async function changeStatus(formData: FormData) {
    "use server";
    const value = formData.get("status");
    if (!isWorkspaceQuoteStatus(value)) return;
    if (!getWorkspaceQuoteTransitions(quote.status).includes(value)) return;
    await transitionDashboardWorkspaceQuoteRequest(quote.id, value);
    redirect(localHref(`/dashboard/offerter/${quote.id}`, locale));
  }

  async function createOffer(formData: FormData) {
    "use server";
    const result = validateWorkspaceQuoteOfferDraft({
      amount: formData.get("amount"), vatRate: formData.get("vatRate"), title: formData.get("title"),
      terms: formData.get("terms"), validUntil: formData.get("validUntil"), currency,
    });
    if (!result.ok) redirect(localHref(`/dashboard/offerter/${quote.id}`, locale, { offer: "invalid" }));
    await createDashboardWorkspaceQuoteOfferDraft(quote.id, result.value);
    redirect(localHref(`/dashboard/offerter/${quote.id}`, locale, { offer: "created" }));
  }

  const location = [quote.postalCode, quote.city].filter(Boolean).join(" ");
  const canCreateOffer = quote.status === "submitted" || quote.status === "reviewing";

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

      <section className="rounded-3xl border border-[#e0e6de] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-[#557061]" /><h2 className="text-lg font-bold text-[#17201a]">{text.offers}</h2></div>
        {offerMessage ? <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${offerMessage === "created" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{offerMessage === "created" ? text.created : text.invalid}</p> : null}
        <div className="mt-5 grid gap-4">
          {offers.length ? offers.map((offer) => (
            <article key={offer.id} className="rounded-2xl border border-[#e0e6de] bg-[#fafbf9] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-bold text-[#17201a]">{offer.title}</p><p className="mt-1 text-xs text-[#667269]">{text.version} {offer.version} · {offerStatusLabel[locale][offer.status]}</p></div><p className="text-lg font-extrabold text-[#173e2b]">{formatMoney(offer.totalMinor, offer.currency, locale)}</p></div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs font-bold uppercase text-[#7d877f]">{text.subtotal}</dt><dd>{formatMoney(offer.subtotalMinor, offer.currency, locale)}</dd></div><div><dt className="text-xs font-bold uppercase text-[#7d877f]">{text.vat} ({offer.vatRateBasisPoints / 100}%)</dt><dd>{formatMoney(offer.vatAmountMinor, offer.currency, locale)}</dd></div><div><dt className="text-xs font-bold uppercase text-[#7d877f]">{text.total}</dt><dd className="font-bold">{formatMoney(offer.totalMinor, offer.currency, locale)}</dd></div></dl>
            </article>
          )) : <p className="text-sm text-[#667269]">{text.noOffers}</p>}
        </div>
      </section>

      {canCreateOffer ? (
        <section className="rounded-3xl border border-[#dbe3d8] bg-[#f7f9f6] p-5 sm:p-6">
          <h2 className="text-lg font-bold text-[#17201a]">{text.createOffer}</h2>
          <form action={createOffer} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold"><span>{text.offerTitle}</span><input name="title" required maxLength={160} className="min-h-11 rounded-xl border border-[#cfd8cf] bg-white px-3" /></label>
            <label className="grid gap-1.5 text-sm font-semibold"><span>{text.validUntil}</span><input name="validUntil" type="date" className="min-h-11 rounded-xl border border-[#cfd8cf] bg-white px-3" /></label>
            <label className="grid gap-1.5 text-sm font-semibold"><span>{text.amount} ({currency})</span><input name="amount" required inputMode="decimal" placeholder="0.00" className="min-h-11 rounded-xl border border-[#cfd8cf] bg-white px-3" /></label>
            <label className="grid gap-1.5 text-sm font-semibold"><span>{text.vatRate}</span><input name="vatRate" required inputMode="decimal" placeholder="0" className="min-h-11 rounded-xl border border-[#cfd8cf] bg-white px-3" /></label>
            <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2"><span>{text.terms}</span><textarea name="terms" maxLength={5000} rows={4} className="rounded-xl border border-[#cfd8cf] bg-white px-3 py-2" /></label>
            <button type="submit" className="min-h-11 w-fit rounded-xl bg-[#173e2b] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0f3020]">{text.saveDraft}</button>
          </form>
        </section>
      ) : null}

      {nextStatuses.length > 0 ? (
        <section className="rounded-3xl border border-[#dbe3d8] bg-[#f7f9f6] p-5 sm:p-6">
          <h2 className="text-lg font-bold text-[#17201a]">{text.changeStatus}</h2>
          <div className="mt-4 flex flex-wrap gap-3">{nextStatuses.map((status: WorkspaceQuoteStatus) => <form key={status} action={changeStatus}><input type="hidden" name="status" value={status} /><button type="submit" className="min-h-11 rounded-xl bg-[#173e2b] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0f3020]">{statusLabel[locale][status]}</button></form>)}</div>
        </section>
      ) : null}
    </div>
  );
}
