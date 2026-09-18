import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Download, FileText, ShieldCheck, XCircle } from "lucide-react";

import lifecycleStyles from "@/components/customer-lifecycle/customer-lifecycle.module.css";
import { getPublicWorkspaceQuoteOffer } from "@/lib/workspace-quote-offers-db";
import {
  publicWorkspaceQuoteOfferPath,
  publicWorkspaceQuoteOfferPdfPath,
} from "@/lib/workspace-quote-offer-public";
import { respondToPublicQuoteOfferAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Offert",
  robots: { index: false, follow: false },
};

type Locale = "sv" | "en";

const copy = {
  sv: {
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

function publicHref(token: string, locale: Locale, response?: string) {
  const query = new URLSearchParams();
  if (locale === "en") query.set("lang", "en");
  if (response) query.set("response", response);
  const suffix = query.toString();
  const base = publicWorkspaceQuoteOfferPath(token);
  return suffix ? `${base}?${suffix}` : base;
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
  const response = Array.isArray(query?.response) ? query.response[0] : query?.response;

  if (!offer) {
    return (
      <main lang={locale} className={lifecycleStyles.page}>
        <section className={lifecycleStyles.unavailable}>
          <h1>{text.unavailableTitle}</h1>
          <p>{text.unavailableBody}</p>
          <p>{text.contact}</p>
        </section>
      </main>
    );
  }

  const action = respondToPublicQuoteOfferAction.bind(null, token);
  const isOpen = offer.status === "sent";
  const isAccepted = offer.status === "accepted";

  return (
    <main lang={locale} className={lifecycleStyles.page}>
      <div className={lifecycleStyles.shell}>
        <div className={lifecycleStyles.topbar}>
          <div>
            <p className={lifecycleStyles.eyebrow}>{text.eyebrow}</p>
            <h1 className={lifecycleStyles.title}>{offer.companyName}</h1>
            <p className={lifecycleStyles.greeting}>{text.greeting} {offer.customerName}</p>
          </div>
          <nav className={lifecycleStyles.languageNav} aria-label={locale === "en" ? "Language" : "Språk"}>
            <Link href={publicHref(token, "sv", response)} className={locale === "sv" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>SV</Link>
            <Link href={publicHref(token, "en", response)} className={locale === "en" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>EN</Link>
          </nav>
        </div>

        {response === "invalid" ? <p className={lifecycleStyles.noticeError} role="alert">{text.statusError}</p> : null}

        <section className={lifecycleStyles.panel}>
          <dl className={lifecycleStyles.metaGrid}>
            <div className={lifecycleStyles.metaCell}><dt>{text.request}</dt><dd>{offer.quoteReferenceId}</dd></div>
            <div className={lifecycleStyles.metaCell}><dt>{text.validUntil}</dt><dd>{offer.validUntil ? formatDate(offer.validUntil, locale) : "—"}</dd></div>
            <div className={lifecycleStyles.metaCell}><dt>{text.sentAt}</dt><dd>{formatDate(offer.sentAt, locale)}</dd></div>
          </dl>

          <div className={lifecycleStyles.panelBody}>
            <article className={lifecycleStyles.document}>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#1469d8]" aria-hidden="true" />
                <div>
                  <h2 className={lifecycleStyles.documentTitle}>{offer.title}</h2>
                  {offer.terms ? <p className={lifecycleStyles.documentText}>{offer.terms}</p> : null}
                </div>
              </div>
            </article>

            <dl className={lifecycleStyles.moneyGrid}>
              <div className={lifecycleStyles.moneyCell}><dt>{text.subtotal}</dt><dd>{formatMoney(offer.subtotalMinor, offer.currency, locale)}</dd></div>
              <div className={lifecycleStyles.moneyCell}><dt>{text.vat} ({offer.vatRateBasisPoints / 100}%)</dt><dd>{formatMoney(offer.vatAmountMinor, offer.currency, locale)}</dd></div>
              <div className={lifecycleStyles.moneyCell}><dt>{text.total}</dt><dd className={lifecycleStyles.moneyTotal}>{formatMoney(offer.totalMinor, offer.currency, locale)}</dd></div>
            </dl>

            <div className={lifecycleStyles.actions}>
              <Link href={pdfHref(token, locale)} prefetch={false} className={lifecycleStyles.secondaryAction}>
                <Download className="h-4 w-4" aria-hidden="true" />{text.downloadPdf}
              </Link>
            </div>

            {isOpen ? (
              <div className={lifecycleStyles.actions}>
                <form action={action} className="flex-1">
                  <input type="hidden" name="decision" value="accepted" />
                  <input type="hidden" name="lang" value={locale} />
                  <button type="submit" className={`${lifecycleStyles.primaryAction} w-full`}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />{text.accept}
                  </button>
                </form>
                <form action={action} className="flex-1">
                  <input type="hidden" name="decision" value="rejected" />
                  <input type="hidden" name="lang" value={locale} />
                  <button type="submit" className={`${lifecycleStyles.dangerAction} w-full`}>
                    <XCircle className="h-4 w-4" aria-hidden="true" />{text.reject}
                  </button>
                </form>
              </div>
            ) : (
              <section className={isAccepted ? lifecycleStyles.noticeSuccess : lifecycleStyles.noticeError}>
                <strong>{isAccepted ? text.accepted : text.rejected}</strong>
                <p className="mt-1">{isAccepted ? text.acceptedBody : text.rejectedBody}</p>
              </section>
            )}

            <p className={lifecycleStyles.protected}><ShieldCheck aria-hidden="true" />{text.protected}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
