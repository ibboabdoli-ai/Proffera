import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Download, FileText, ShieldCheck, XCircle } from "lucide-react";

import { respondToPublicQuoteOfferAction } from "./actions";
import styles from "@/app/public-customer-lifecycle.module.css";
import { getPublicWorkspaceQuoteOffer } from "@/lib/workspace-quote-offers-db";
import {
  publicWorkspaceQuoteOfferPath,
  publicWorkspaceQuoteOfferPdfPath,
} from "@/lib/workspace-quote-offer-public";

export const dynamic = "force-dynamic";

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

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const query = await (searchParams ?? Promise.resolve(undefined));
  const locale = localeFrom(query?.lang);
  return {
    title: locale === "en" ? "Quote" : "Offert",
    robots: { index: false, follow: false },
  };
}

function publicHref(token: string, locale: Locale, response?: string) {
  const query = new URLSearchParams();
  if (locale === "en") query.set("lang", "en");
  if (response) query.set("response", response);
  const suffix = query.toString();
  const base = publicWorkspaceQuoteOfferPath(token);
  return suffix ? base + "?" + suffix : base;
}

function pdfHref(token: string, locale: Locale) {
  const base = publicWorkspaceQuoteOfferPdfPath(token);
  return locale === "en" ? base + "?lang=en" : base;
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
      <main lang={locale} className={styles.page}>
        <section className={[styles.frame, styles.narrowFrame].join(" ")}>
          <header className={styles.header}>
            <div className={styles.headerRow}>
              <div className={styles.headerCopy}>
                <p className={styles.eyebrow}>{text.eyebrow}</p>
                <h1 className={styles.title}>{text.unavailableTitle}</h1>
              </div>
              <Link href={publicHref(token, alternativeLocale, response)} className={styles.languageLink}>
                {text.language}
              </Link>
            </div>
          </header>
          <div className={styles.stateBody}>
            <XCircle className={styles.stateIcon} aria-hidden="true" />
            <p className={styles.reviewLead}>{text.unavailableBody}</p>
            <p className={styles.reviewLead}>{text.contact}</p>
          </div>
        </section>
      </main>
    );
  }

  const action = respondToPublicQuoteOfferAction.bind(null, token);
  const isOpen = offer.status === "sent";
  const isAccepted = offer.status === "accepted";

  return (
    <main lang={locale} className={styles.page}>
      <section className={styles.frame}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}>
              <p className={styles.eyebrow}>{text.eyebrow}</p>
              <h1 className={styles.title}>{offer.companyName}</h1>
              <p className={styles.intro}>
                {text.greeting} {offer.customerName}
              </p>
            </div>
            <Link href={publicHref(token, alternativeLocale, response)} className={styles.languageLink}>
              {text.language}
            </Link>
          </div>
        </header>

        <div className={styles.content}>
          {response === "invalid" ? (
            <p className={[styles.notice, styles.noticeError].join(" ")} role="alert">
              {text.statusError}
            </p>
          ) : null}

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{text.request}</dt>
              <dd className={styles.factValue}>{offer.quoteReferenceId}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{text.sentAt}</dt>
              <dd className={styles.factValue}>{formatDate(offer.sentAt, locale)}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{text.validUntil}</dt>
              <dd className={styles.factValue}>{offer.validUntil ? formatDate(offer.validUntil, locale) : "—"}</dd>
            </div>
          </dl>

          <article className={[styles.panel, styles.iconPanel].join(" ")}>
            <span className={styles.iconBadge}>
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className={styles.panelTitle}>{offer.title}</h2>
              {offer.terms ? <p className={styles.panelBody}>{offer.terms}</p> : null}
            </div>
          </article>

          <dl className={styles.priceGrid}>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{text.subtotal}</dt>
              <dd className={styles.factValue}>{formatMoney(offer.subtotalMinor, offer.currency, locale)}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>
                {text.vat} ({offer.vatRateBasisPoints / 100}%)
              </dt>
              <dd className={styles.factValue}>{formatMoney(offer.vatAmountMinor, offer.currency, locale)}</dd>
            </div>
            <div className={[styles.fact, styles.priceTotal].join(" ")}>
              <dt className={styles.factLabel}>{text.total}</dt>
              <dd className={styles.factValue}>{formatMoney(offer.totalMinor, offer.currency, locale)}</dd>
            </div>
          </dl>

          <Link href={pdfHref(token, locale)} prefetch={false} className={styles.secondaryButton}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {text.downloadPdf}
          </Link>

          {isOpen ? (
            <div className={styles.actions}>
              <form action={action}>
                <input type="hidden" name="decision" value="accepted" />
                <input type="hidden" name="lang" value={locale} />
                <button type="submit" className={styles.primaryButton}>
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                  {text.accept}
                </button>
              </form>
              <form action={action}>
                <input type="hidden" name="decision" value="rejected" />
                <input type="hidden" name="lang" value={locale} />
                <button type="submit" className={styles.dangerButton}>
                  <XCircle className="h-5 w-5" aria-hidden="true" />
                  {text.reject}
                </button>
              </form>
            </div>
          ) : (
            <section className={[styles.notice, isAccepted ? styles.noticeSuccess : styles.noticeMuted].join(" ")}>
              <h2 className={styles.sectionTitle}>{isAccepted ? text.accepted : text.rejected}</h2>
              <p className={styles.sectionCopy}>{isAccepted ? text.acceptedBody : text.rejectedBody}</p>
            </section>
          )}

          <p className={styles.secureLine}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {text.protected}
          </p>
        </div>
      </section>
    </main>
  );
}
