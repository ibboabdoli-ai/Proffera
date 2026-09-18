import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";
import { getPublicServiceJobPayment } from "@/lib/workspace-service-job-payments";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";

const copy = {
  sv: {
    title: "Betalning",
    language: "English",
    unavailableTitle: "Betalningslänken kan inte användas",
    unavailableBody: "Länken är ogiltig eller betalningen är inte längre tillgänglig.",
    amount: "Att betala",
    paid: "Betalningen är mottagen.",
    pending: "Stripe har skickat tillbaka dig till Proffera. Vi väntar på den säkra betalningsbekräftelsen.",
    unavailable: "Betalningen är tillfälligt otillgänglig. Kontakta företaget.",
    pay: "Betala säkert med Stripe",
    security: "Betalningen hanteras av Stripe. Proffera lagrar inte dina kortuppgifter.",
  },
  en: {
    title: "Payment",
    language: "Svenska",
    unavailableTitle: "This payment link cannot be used",
    unavailableBody: "The link is invalid or the payment is no longer available.",
    amount: "Amount due",
    paid: "Payment received.",
    pending: "Stripe has returned you to Proffera. We are waiting for the secure payment confirmation.",
    unavailable: "Payment is temporarily unavailable. Contact the business.",
    pay: "Pay securely with Stripe",
    security: "Payment is handled by Stripe. Proffera does not store your card details.",
  },
} as const;

function localeFrom(value: string | string[] | undefined): Locale {
  return Array.isArray(value) ? (value[0] === "en" ? "en" : "sv") : value === "en" ? "en" : "sv";
}

function paymentHref(token: string, locale: Locale) {
  const base = `/betala/${encodeURIComponent(token)}`;
  return locale === "en" ? `${base}?lang=en` : base;
}

function money(amount: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency",
    currency,
  }).format(amount / 100);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const query = await (searchParams ?? Promise.resolve(undefined));
  const locale = localeFrom(query?.lang);
  return {
    title: locale === "en" ? "Payment" : "Betalning",
    robots: { index: false, follow: false },
  };
}

export default async function PublicPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[]; status?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = localeFrom(query?.lang);
  const text = copy[locale];
  const alternative: Locale = locale === "en" ? "sv" : "en";
  const status = Array.isArray(query?.status) ? query?.status[0] : query?.status;
  const payment = await getPublicServiceJobPayment(token);

  if (!payment) {
    return (
      <main lang={locale} className={styles.page}>
        <section className={[styles.shell, styles.narrow].join(" ")}>
          <header className={styles.header}>
            <div className={styles.headerRow}>
              <div className={styles.headerCopy}>
                <p className={styles.eyebrow}>Proffera</p>
                <h1 className={styles.title}>{text.unavailableTitle}</h1>
              </div>
              <Link href={paymentHref(token, alternative)} className={styles.languageLink}>{text.language}</Link>
            </div>
          </header>
          <div className={styles.stateBody}>
            <p className={styles.sectionCopy}>{text.unavailableBody}</p>
          </div>
        </section>
      </main>
    );
  }

  const paid = payment.status === "paid";

  return (
    <main lang={locale} className={styles.page}>
      <section className={[styles.shell, styles.narrow].join(" ")}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}>
              <p className={styles.eyebrow}>{payment.companyName}</p>
              <h1 className={styles.title}>{text.title}</h1>
              <p className={styles.intro}>{payment.title}</p>
            </div>
            <Link href={paymentHref(token, alternative)} className={styles.languageLink}>{text.language}</Link>
          </div>
        </header>

        <div className={styles.content}>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt className={styles.label}>{text.amount}</dt>
              <dd className={styles.value} style={{ fontSize: "1.45rem", color: "#0a2e63" }}>
                {money(payment.amountMinor, payment.currency, locale)}
              </dd>
            </div>
          </dl>

          {paid ? (
            <p className={[styles.notice, styles.success].join(" ")} role="status">
              <CheckCircle2 className="mr-2 inline h-5 w-5" aria-hidden="true" />
              {text.paid}
            </p>
          ) : status === "success" ? (
            <p className={[styles.notice, styles.info].join(" ")} role="status">{text.pending}</p>
          ) : null}

          {!paid && payment.accountReady ? (
            <form method="post" action="/api/public/payments/checkout">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="lang" value={locale} />
              <button type="submit" className={[styles.primaryButton, styles.fullButton].join(" ")}>
                <CreditCard className="h-5 w-5" aria-hidden="true" />
                {text.pay}
              </button>
            </form>
          ) : !paid ? (
            <p className={[styles.notice, styles.error].join(" ")} role="alert">{text.unavailable}</p>
          ) : null}

          <p className={styles.secureLine}>
            <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />
            {text.security}
          </p>
        </div>
      </section>
    </main>
  );
}
