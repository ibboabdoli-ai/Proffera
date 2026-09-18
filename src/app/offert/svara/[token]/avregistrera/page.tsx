import type { Metadata } from "next";
import Link from "next/link";

import { guestFlowLocaleFrom, guestOptOutHref, guestQuoteHref, type GuestFlowLocale } from "../guest-flow-locale";
import providerStyles from "@/components/provider-lifecycle/provider-lifecycle.module.css";
import { getMarketplaceGuestOptOutViewWithHistory } from "@/lib/marketplace-guest-opt-out-history";

export const dynamic = "force-dynamic";

const copy = {
  sv: {
    metadataTitle: "Avregistrera offertförfrågningar",
    language: "English",
    unavailableTitle: "Länken kan inte användas",
    unavailableBody: "Vi kunde inte hitta den här företagsinbjudan.",
    doneTitle: "Klart",
    doneBody: "Den här företagsadressen får inte fler gästförfrågningar från Proffera.",
    dispatchTitle: "Avregistreringen är registrerad",
    dispatchBody: "Inga nya gästinbjudningar startas till den här adressen. Ett mejl som redan hade börjat levereras innan avregistreringen kan fortfarande komma fram.",
    title: "Stoppa framtida gästförfrågningar?",
    bodyPrefix: "Detta gäller företagsadressen som användes för",
    bodySuffix: "Efter avregistrering skickar Proffera inte fler gästinbjudningar till adressen.",
    rateLimited: "För många försök. Vänta en stund och försök igen.",
    failed: "Avregistreringen kunde inte slutföras. Försök igen senare.",
    confirm: "Ja, avregistrera adressen",
    back: "Tillbaka till förfrågan",
  },
  en: {
    metadataTitle: "Opt out of quote requests",
    language: "Svenska",
    unavailableTitle: "This link cannot be used",
    unavailableBody: "We could not find this business invitation.",
    doneTitle: "Done",
    doneBody: "This business email address will not receive more guest requests from Proffera.",
    dispatchTitle: "Your opt-out is registered",
    dispatchBody: "No new guest invitations will be started for this address. An email that had already started delivery before the opt-out may still arrive.",
    title: "Stop future guest requests?",
    bodyPrefix: "This applies to the business email address used for",
    bodySuffix: "After opting out, Proffera will not send more guest invitations to this address.",
    rateLimited: "Too many attempts. Wait a while and try again.",
    failed: "The opt-out could not be completed. Try again later.",
    confirm: "Yes, opt out this address",
    back: "Back to the request",
  },
} as const;

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const query = await (searchParams ?? Promise.resolve(undefined));
  const locale = guestFlowLocaleFrom(query?.lang);
  return {
    title: copy[locale].metadataTitle,
    robots: { index: false, follow: false },
  };
}

export default async function MarketplaceGuestOptOutPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ status?: string | string[]; lang?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = guestFlowLocaleFrom(query?.lang);
  const text = copy[locale];
  const view = await getMarketplaceGuestOptOutViewWithHistory(token);
  const rawStatus = query?.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const languageNav = (
    <nav className={providerStyles.languageNav} aria-label={locale === "en" ? "Language" : "Språk"}>
      <Link href={guestOptOutHref(token, "sv", status)} className={locale === "sv" ? providerStyles.languageActive : providerStyles.languageLink}>SV</Link>
      <Link href={guestOptOutHref(token, "en", status)} className={locale === "en" ? providerStyles.languageActive : providerStyles.languageLink}>EN</Link>
    </nav>
  );

  if (!view) {
    return (
      <main lang={locale} className={providerStyles.page}>
        <section className={providerStyles.unavailable}>
          {languageNav}
          <h1>{text.unavailableTitle}</h1>
          <p>{text.unavailableBody}</p>
        </section>
      </main>
    );
  }

  if (status === "dispatch_in_progress") {
    return (
      <main lang={locale} className={providerStyles.page}>
        <section className={providerStyles.unavailable}>
          {languageNav}
          <h1>{text.dispatchTitle}</h1>
          <p>{text.dispatchBody}</p>
        </section>
      </main>
    );
  }

  if (status === "done" || view.status === "suppressed") {
    return (
      <main lang={locale} className={providerStyles.page}>
        <section className={providerStyles.unavailable}>
          {languageNav}
          <h1>{text.doneTitle}</h1>
          <p>{text.doneBody}</p>
        </section>
      </main>
    );
  }

  return (
    <main lang={locale} className={providerStyles.page}>
      <div className={providerStyles.shell}>
        <div className={providerStyles.topbar}>
          <div>
            <p className={providerStyles.eyebrow}>Proffera</p>
            <h1 className={providerStyles.title}>{text.title}</h1>
            <p className={providerStyles.lead}>{text.bodyPrefix} {view.companyName}. {text.bodySuffix}</p>
          </div>
          {languageNav}
        </div>

        {status ? (
          <p className={providerStyles.noticeError} role="alert">
            {status === "rate_limited" ? text.rateLimited : text.failed}
          </p>
        ) : null}

        <section className={providerStyles.panel}>
          <div className={providerStyles.panelBody}>
            <form method="post" action={`/api/marketplace/guest-quote/${encodeURIComponent(token)}/opt-out`} className={providerStyles.form}>
              <input type="hidden" name="lang" value={locale} />
              <button type="submit" className={providerStyles.danger}>{text.confirm}</button>
            </form>
            <Link href={guestQuoteHref(token, locale)} className={`${providerStyles.secondary} mt-3`}>{text.back}</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
