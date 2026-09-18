import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/app/remaining-public-experience.module.css";
import { guestFlowLocaleFrom, guestOptOutHref, guestQuoteHref, type GuestFlowLocale } from "../guest-flow-locale";
import { getMarketplaceGuestOptOutViewWithHistory } from "@/lib/marketplace-guest-opt-out-history";

export const dynamic = "force-dynamic";

const copy = {
  sv: {
    metadataTitle: "Avregistrera offertförfrågningar", language: "English",
    unavailableTitle: "Länken kan inte användas", unavailableBody: "Vi kunde inte hitta den här företagsinbjudan.",
    doneTitle: "Klart", doneBody: "Den här företagsadressen får inte fler gästförfrågningar från Proffera.",
    dispatchTitle: "Avregistreringen är registrerad", dispatchBody: "Inga nya gästinbjudningar startas till den här adressen. Ett mejl som redan hade börjat levereras innan avregistreringen kan fortfarande komma fram.",
    title: "Stoppa framtida gästförfrågningar?", bodyPrefix: "Detta gäller företagsadressen som användes för", bodySuffix: "Efter avregistrering skickar Proffera inte fler gästinbjudningar till adressen.",
    rateLimited: "För många försök. Vänta en stund och försök igen.", failed: "Avregistreringen kunde inte slutföras. Försök igen senare.",
    confirm: "Ja, avregistrera adressen", back: "Tillbaka till förfrågan",
  },
  en: {
    metadataTitle: "Opt out of quote requests", language: "Svenska",
    unavailableTitle: "This link cannot be used", unavailableBody: "We could not find this business invitation.",
    doneTitle: "Done", doneBody: "This business email address will not receive more guest requests from Proffera.",
    dispatchTitle: "Your opt-out is registered", dispatchBody: "No new guest invitations will be started for this address. An email that had already started delivery before the opt-out may still arrive.",
    title: "Stop future guest requests?", bodyPrefix: "This applies to the business email address used for", bodySuffix: "After opting out, Proffera will not send more guest invitations to this address.",
    rateLimited: "Too many attempts. Wait a while and try again.", failed: "The opt-out could not be completed. Try again later.",
    confirm: "Yes, opt out this address", back: "Back to the request",
  },
} as const;

export async function generateMetadata({ searchParams }: { searchParams?: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const query = await (searchParams ?? Promise.resolve(undefined));
  const locale = guestFlowLocaleFrom(query?.lang);
  return { title: copy[locale].metadataTitle, robots: { index: false, follow: false } };
}

export default async function MarketplaceGuestOptOutPage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ status?: string | string[]; lang?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = guestFlowLocaleFrom(query?.lang);
  const text = copy[locale];
  const alternativeLocale: GuestFlowLocale = locale === "en" ? "sv" : "en";
  const view = await getMarketplaceGuestOptOutViewWithHistory(token);
  const rawStatus = query?.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  const state = !view
    ? { title: text.unavailableTitle, body: text.unavailableBody, kind: "error" as const }
    : status === "dispatch_in_progress"
      ? { title: text.dispatchTitle, body: text.dispatchBody, kind: "info" as const }
      : status === "done" || view.status === "suppressed"
        ? { title: text.doneTitle, body: text.doneBody, kind: "success" as const }
        : null;

  if (state) {
    const stateClass = state.kind === "success" ? styles.success : state.kind === "error" ? styles.error : styles.info;
    return (
      <main lang={locale} className={styles.page}>
        <section className={[styles.shell, styles.narrow].join(" ")}>
          <header className={styles.header}>
            <div className={styles.headerRow}>
              <div className={styles.headerCopy}><p className={styles.eyebrow}>Proffera</p><h1 className={styles.title}>{state.title}</h1></div>
              <Link href={guestOptOutHref(token, alternativeLocale, status)} className={styles.languageLink}>{text.language}</Link>
            </div>
          </header>
          <div className={styles.content}><p className={[styles.notice, stateClass].join(" ")}>{state.body}</p></div>
        </section>
      </main>
    );
  }

  if (!view) return null;

  return (
    <main lang={locale} className={styles.page}>
      <section className={[styles.shell, styles.narrow].join(" ")}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}><p className={styles.eyebrow}>Proffera</p><h1 className={styles.title}>{text.title}</h1></div>
            <Link href={guestOptOutHref(token, alternativeLocale, status)} className={styles.languageLink}>{text.language}</Link>
          </div>
        </header>
        <div className={styles.content}>
          <p className={styles.sectionCopy}>{text.bodyPrefix} {view.companyName}. {text.bodySuffix}</p>
          {status ? <p className={[styles.notice, styles.error].join(" ")} role="alert">{status === "rate_limited" ? text.rateLimited : text.failed}</p> : null}
          <form method="post" action={`/api/marketplace/guest-quote/${encodeURIComponent(token)}/opt-out`}>
            <input type="hidden" name="lang" value={locale} />
            <button type="submit" className={[styles.dangerButton, styles.fullButton].join(" ")}>{text.confirm}</button>
          </form>
          <Link href={guestQuoteHref(token, locale)} className={styles.secondaryButton}>{text.back}</Link>
        </div>
      </section>
    </main>
  );
}
