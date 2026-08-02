import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Download, FileText, ShieldCheck, XCircle } from "lucide-react";

import { respondToPublicQuoteOfferAction } from "./actions";
import { getPublicWorkspaceQuoteOffer } from "@/lib/workspace-quote-offers-db";
import {
  publicWorkspaceQuoteOfferPath,
  publicWorkspaceQuoteOfferPdfPath,
} from "@/lib/workspace-quote-offer-public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Offert",
  robots: { index: false, follow: false },
};

type Locale = "sv" | "en";

const copy = {
  sv: {
    language: "English",
    unavailableTitle: "Länken kan inte användas",
    unavailableBody: "Offerten är ogiltig, har gått ut eller har redan stängts.",
    contact: "Kontakta företaget om du behöver hjälp.",
    eyebrow: "Din offert",
    greeting: "Hej",
    request: "Förfrågan",
    validUntil: "Giltig till",
    subtotal: "Exkl. moms",
    vat: "Moms",
    total: "Totalt",
    terms: "Villkor",
    downloadPdf: "Ladda ner PDF",
    accept: "Acceptera offert",
    reject: "Tacka nej",
    accepted: "Offerten är accepterad",
    rejected: "Offerten är avslagen",
    acceptedBody: "Tack. Företaget har fått ditt svar och kan kontakta dig om nästa steg.",
    rejectedBody: "Ditt svar har skickats till företaget.",
    statusError: "Ditt svar kunde inte registreras. Ladda om sidan och försök igen.",
    sentAt: "Skickad",
    protected: "Säker personlig länk",
  },
  en: {
    language: "Svenska",
    unavailableTitle: "This link cannot be used",
    unavailableBody: "The offer is invalid, has expired, or is no longer open.",
    contact: "Contact the business if you need help.",
    eyebrow: "Your quote",
    greeting: "Hello",
    request: "Enquiry",
    validUntil: "Valid until",
    subtotal: "Excluding VAT",
    vat: "VAT",
    total: "Total",
    terms: "Terms",
    downloadPdf: "Download PDF",
    accept: "Accept quote",
    reject: "Decline quote",
    accepted: "Quote accepted",
    rejected: "Quote declined",
    acceptedBody: "Thank you. The business has received your response and can contact you about the next step.",
    rejectedBody: "Your response has been sent to the business.",
    statusError: "Your response could not be registered. Reload the page and try again.",
    sentAt: "Sent",
    protected: "Secure personal link",
  },
} as const;

function localeFrom(value: string | string[] | undefined): Locale {
  return Array.isArray(value) ? (value[0] === "en" ? "en" : "sv") : value === "en" ? "en" : "sv";
}

function publicHref(token: string, locale: Locale) {
  const base = publicWorkspaceQuoteOfferPath(token);
  return locale === "en" ? `${base}?lang=en` : base;
}

function pdfHref(token: string, locale: Locale) {
  const base = publicWorkspaceQuoteOfferPdfPath(token);
  return locale === "en" ? `${base}?lang=en` : base;
}

function formatMoney(amountMinor: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "long" }).format(new Date(value));
}

export default async function PublicQuoteOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[]; response?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = localeFrom(query?.lang);
  const text = copy[locale];
  const offer = await getPublicWorkspaceQuoteOffer(token);
  const response = Array.isArray(query?.response) ? query?.response[0] : query?.response;
  const alternativeLocale: Locale = locale === "en" ? "sv" : "en";

  if (!offer) {
    return (
      <main className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <XCircle className="mx-auto h-10 w-10 text-[#a95b50]" aria-hidden="true" />
          <h1 className="mt-5 text-3xl font-bold text-[#17201a]">{text.unavailableTitle}</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">{text.unavailableBody}</p>
          <p className="mt-3 text-sm text-[#667168]">{text.contact}</p>
        </section>
      </main>
    );
  }

  const action = respondToPublicQuoteOfferAction.bind(null, token);
  const isOpen = offer.status === "sent";
  const isAccepted = offer.status === "accepted";

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-8 text-[#17201a] sm:px-6 sm:py-12">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-[#dfe5dd]">
        <header className="bg-[#102a1c] px-6 py-7 text-white sm:px-10 sm:py-9">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a9dbb9]">{text.eyebrow}</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.03em]">{offer.companyName}</h1></div><Link href={publicHref(token, alternativeLocale)} className="rounded-lg border border-white/35 px-3 py-2 text-xs font-bold text-white">{text.language}</Link></div>
          <p className="mt-4 text-sm text-white/80">{text.greeting} {offer.customerName}</p>
        </header>

        <div className="grid gap-7 p-6 sm:p-10">
          {response === "invalid" ? <p className="rounded-xl bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#8a2b20]" role="alert">{text.statusError}</p> : null}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-sm font-bold uppercase tracking-wide text-[#6b776d]">{text.request}</p><p className="mt-1 font-semibold">{offer.quoteReferenceId}</p></div>
            <div className="text-left sm:text-right"><p className="text-sm font-bold uppercase tracking-wide text-[#6b776d]">{text.validUntil}</p><p className="mt-1 font-semibold">{offer.validUntil ? formatDate(offer.validUntil, locale) : "—"}</p></div>
          </div>

          <article className="rounded-2xl border border-[#dce5da] bg-[#fafcf9] p-5 sm:p-6"><div className="flex items-start gap-3"><FileText className="mt-0.5 h-6 w-6 shrink-0 text-[#17452f]" aria-hidden="true" /><div><h2 className="text-xl font-bold">{offer.title}</h2>{offer.terms ? <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#4d5b52]">{offer.terms}</p> : null}</div></div></article>

          <dl className="grid gap-4 rounded-2xl border border-[#dce5da] p-5 text-sm sm:grid-cols-3"><div><dt className="font-bold uppercase tracking-wide text-[#6b776d]">{text.subtotal}</dt><dd className="mt-2">{formatMoney(offer.subtotalMinor, offer.currency, locale)}</dd></div><div><dt className="font-bold uppercase tracking-wide text-[#6b776d]">{text.vat} ({offer.vatRateBasisPoints / 100}%)</dt><dd className="mt-2">{formatMoney(offer.vatAmountMinor, offer.currency, locale)}</dd></div><div><dt className="font-bold uppercase tracking-wide text-[#6b776d]">{text.total}</dt><dd className="mt-2 text-xl font-extrabold text-[#173e2b]">{formatMoney(offer.totalMinor, offer.currency, locale)}</dd></div></dl>

          <Link href={pdfHref(token, locale)} prefetch={false} className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-xl border border-[#bfd0c0] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f] transition hover:bg-[#f2f7f2]"><Download className="h-4 w-4" aria-hidden="true" />{text.downloadPdf}</Link>

          {isOpen ? (
            <div className="grid gap-3 sm:grid-cols-2"><form action={action}><input type="hidden" name="decision" value="accepted" /><input type="hidden" name="lang" value={locale} /><button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#17452f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#103822]"><CheckCircle2 className="h-5 w-5" aria-hidden="true" />{text.accept}</button></form><form action={action}><input type="hidden" name="decision" value="rejected" /><input type="hidden" name="lang" value={locale} /><button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#d3a39d] bg-white px-5 py-3 text-sm font-bold text-[#8a2b20] transition hover:bg-[#fff7f5]"><XCircle className="h-5 w-5" aria-hidden="true" />{text.reject}</button></form></div>
          ) : (
            <section className={`rounded-2xl p-5 ${isAccepted ? "bg-[#edf8ef] text-[#17452f]" : "bg-[#fff4f2] text-[#8a2b20]"}`}><h2 className="font-bold">{isAccepted ? text.accepted : text.rejected}</h2><p className="mt-2 text-sm leading-6">{isAccepted ? text.acceptedBody : text.rejectedBody}</p></section>
          )}

          <p className="flex items-center gap-2 text-xs text-[#6b776d]"><ShieldCheck className="h-4 w-4 text-[#557061]" aria-hidden="true" />{text.protected} · {text.sentAt} {formatDate(offer.sentAt, locale)}</p>
        </div>
      </section>
    </main>
  );
}
