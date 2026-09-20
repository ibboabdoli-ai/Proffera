import type { Metadata } from "next";
import Link from "next/link";

import {
  guestClaimHref,
  guestFlowLocaleFrom,
  guestOptOutHref,
  guestQuoteHref,
  type GuestFlowLocale,
} from "./guest-flow-locale";
import providerStyles from "@/components/provider-lifecycle/provider-lifecycle.module.css";
import { getMarketplaceGuestQuoteView } from "@/lib/marketplace-guest-quote-human-view";

export const dynamic = "force-dynamic";

const copy = {
  sv: {
    metadataTitle: "Svara på offertförfrågan",
    language: "English",
    unavailableTitle: "Länken kan inte användas",
    unavailableBody: "Förfrågan är ogiltig, har gått ut eller har stängts.",
    suppressedTitle: "Adressen är avregistrerad",
    suppressedBody: "Proffera skickar inte fler gästförfrågningar till den här företagsadressen.",
    responseSent: "Svar skickat",
    thankYou: "Tack",
    responseStored: "Ert svar är registrerat i Proffera och kan nu jämföras med andra svar på förfrågan.",
    price: "Pris",
    inspectionRequired: "Platsbesök krävs",
    available: "Tillgänglig",
    notSpecified: "Ej angivet",
    winnerTitle: "Kunden valde er offert",
    winnerBody: "Kontaktuppgifterna är nu upplåsta för er eftersom kunden valde just ert erbjudande.",
    contactName: "Namn",
    contactEmail: "E-post",
    contactPhone: "Telefon",
    contactAddress: "Adress",
    claimTitle: "Vill ni få nästa förfrågan direkt i ett eget Proffera-konto?",
    claimBody: "Företagsprofilen finns redan. Verifiera den för att koppla framtida offertförfrågningar till er workspace.",
    claimAction: "Verifiera företagsprofil",
    eyebrow: "Offertförfrågan via Proffera",
    inWord: "i",
    to: "Till",
    reference: "Referens",
    category: "Kategori",
    city: "Ort",
    preferredDate: "Önskat datum",
    description: "Beskrivning",
    privacy: "Kundens namn, e-post och telefonnummer delas inte innan kunden väljer att gå vidare.",
    pricingLegend: "Hur vill ni prissätta?",
    fixedPrice: "Fast pris",
    estimate: "Prisuppskattning",
    inspectionOption: "Platsbesök krävs innan pris kan lämnas",
    amountLabel: "Pris / uppskattning i SEK",
    amountPlaceholder: "t.ex. 1800",
    amountHint: "Lämna tomt om ni valt att platsbesök krävs.",
    earliestDate: "Tidigaste datum ni kan hjälpa kunden",
    noteLabel: "Kommentar till kunden",
    notePlaceholder: "Vad ingår, eventuella villkor eller frågor som behöver klargöras?",
    authority: "Jag bekräftar att jag får svara på förfrågan för",
    send: "Skicka svar",
    optOutQuestion: "Vill ni inte få fler sådana förfrågningar?",
    optOutAction: "Avregistrera företagsadressen",
    invalid: "Kontrollera pris och övriga uppgifter och försök igen.",
    rateLimited: "För många försök. Vänta en stund och försök igen.",
    expired: "Länken har gått ut.",
    closed: "Förfrågan är inte längre öppen.",
    alreadyResponded: "Ett svar har redan skickats från den här länken.",
  },
  en: {
    metadataTitle: "Respond to quote request",
    language: "Svenska",
    unavailableTitle: "This link cannot be used",
    unavailableBody: "The request is invalid, has expired, or is no longer open.",
    suppressedTitle: "This address has opted out",
    suppressedBody: "Proffera will not send more guest requests to this business email address.",
    responseSent: "Response sent",
    thankYou: "Thank you",
    responseStored: "Your response is registered in Proffera and can now be compared with other responses to the request.",
    price: "Price",
    inspectionRequired: "Site visit required",
    available: "Available",
    notSpecified: "Not specified",
    winnerTitle: "The customer selected your offer",
    winnerBody: "The customer's contact details are now unlocked for you because they selected your offer.",
    contactName: "Name",
    contactEmail: "Email",
    contactPhone: "Phone",
    contactAddress: "Address",
    claimTitle: "Would you like the next request to arrive directly in your own Proffera account?",
    claimBody: "The business profile already exists. Verify it to connect future quote requests to your workspace.",
    claimAction: "Verify business profile",
    eyebrow: "Quote request via Proffera",
    inWord: "in",
    to: "To",
    reference: "Reference",
    category: "Category",
    city: "Location",
    preferredDate: "Preferred date",
    description: "Description",
    privacy: "The customer's name, email address, and phone number are not shared before the customer chooses to proceed.",
    pricingLegend: "How would you like to price this?",
    fixedPrice: "Fixed price",
    estimate: "Price estimate",
    inspectionOption: "A site visit is required before a price can be provided",
    amountLabel: "Price / estimate in SEK",
    amountPlaceholder: "e.g. 1800",
    amountHint: "Leave blank if you selected that a site visit is required.",
    earliestDate: "Earliest date you can help the customer",
    noteLabel: "Comment to the customer",
    notePlaceholder: "What is included, any conditions, or questions that need clarification?",
    authority: "I confirm that I am authorized to respond to this request for",
    send: "Send response",
    optOutQuestion: "Do you not want to receive more requests like this?",
    optOutAction: "Opt out this business address",
    invalid: "Check the price and other details and try again.",
    rateLimited: "Too many attempts. Wait a while and try again.",
    expired: "The link has expired.",
    closed: "The request is no longer open.",
    alreadyResponded: "A response has already been submitted from this link.",
  },
} as const;

function money(amountMinor: number, locale: GuestFlowLocale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function statusMessage(value: string | undefined, locale: GuestFlowLocale) {
  const text = copy[locale];
  if (value === "invalid" || value === "invalid_amount") return text.invalid;
  if (value === "rate_limited") return text.rateLimited;
  if (value === "expired") return text.expired;
  if (value === "closed") return text.closed;
  if (value === "already_responded") return text.alreadyResponded;
  return "";
}

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

export default async function MarketplaceGuestQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ status?: string | string[]; lang?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = guestFlowLocaleFrom(query?.lang);
  const text = copy[locale];
  const view = await getMarketplaceGuestQuoteView(token);
  const rawStatus = query?.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  const languageNav = (
    <nav className={providerStyles.languageNav} aria-label={locale === "en" ? "Language" : "Språk"}>
      <Link href={guestQuoteHref(token, "sv", status)} className={locale === "sv" ? providerStyles.languageActive : providerStyles.languageLink}>SV</Link>
      <Link href={guestQuoteHref(token, "en", status)} className={locale === "en" ? providerStyles.languageActive : providerStyles.languageLink}>EN</Link>
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

  if (view.status === "suppressed") {
    return (
      <main lang={locale} className={providerStyles.page}>
        <section className={providerStyles.unavailable}>
          {languageNav}
          <h1>{text.suppressedTitle}</h1>
          <p>{text.suppressedBody}</p>
        </section>
      </main>
    );
  }

  if (view.status === "responded" && view.offer) {
    const contact = view.customerContact;
    const contactAddress = contact
      ? [contact.addressLine1, contact.postalCode, contact.city].filter(Boolean).join(", ")
      : "";

    return (
      <main lang={locale} className={providerStyles.page}>
        <div className={providerStyles.shell}>
          <div className={providerStyles.topbar}>
            <div>
              <p className={providerStyles.eyebrow}>{text.responseSent}</p>
              <h1 className={providerStyles.title}>{text.thankYou}, {view.companyName}</h1>
              <p className={providerStyles.lead}>{text.responseStored}</p>
            </div>
            {languageNav}
          </div>

          <section className={providerStyles.panel}>
            <div className={providerStyles.panelBody}>
              <div className={providerStyles.resultGrid}>
                <div className={providerStyles.resultCard}><small>{text.price}</small><b>{view.offer.priceKind === "inspection_required" ? text.inspectionRequired : money(view.offer.amountMinor, locale)}</b></div>
                <div className={providerStyles.resultCard}><small>{text.available}</small><b>{view.offer.availableDate || text.notSpecified}</b></div>
              </div>

              {contact ? (
                <section className={providerStyles.noticeSuccess}>
                  <strong>{text.winnerTitle}</strong>
                  <p className="mt-1">{text.winnerBody}</p>
                  <div className={providerStyles.contactGrid}>
                    <div className={providerStyles.contactCell}><small>{text.contactName}</small><p>{contact.name || text.notSpecified}</p></div>
                    <div className={providerStyles.contactCell}><small>{text.contactEmail}</small><p>{contact.email ? <a href={`mailto:${contact.email}`} className="underline">{contact.email}</a> : text.notSpecified}</p></div>
                    <div className={providerStyles.contactCell}><small>{text.contactPhone}</small><p>{contact.phone ? <a href={`tel:${contact.phone}`} className="underline">{contact.phone}</a> : text.notSpecified}</p></div>
                    <div className={providerStyles.contactCell}><small>{text.contactAddress}</small><p>{contactAddress || text.notSpecified}</p></div>
                  </div>
                </section>
              ) : null}

              <section className={providerStyles.actionBlock}>
                <h2>{text.claimTitle}</h2>
                <p>{text.claimBody}</p>
                <Link href={guestClaimHref(view.profileSlug, locale)} className={`${providerStyles.primary} mt-3`}>{text.claimAction}</Link>
              </section>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const errorMessage = statusMessage(status, locale);

  return (
    <main lang={locale} className={providerStyles.page}>
      <div className={providerStyles.shell}>
        <div className={providerStyles.topbar}>
          <div>
            <p className={providerStyles.eyebrow}>{text.eyebrow}</p>
            <h1 className={providerStyles.title}>{view.serviceType} {text.inWord} {view.city}</h1>
            <p className={providerStyles.lead}>{text.to} {view.companyName} · {text.reference} {view.quoteReferenceId}</p>
          </div>
          {languageNav}
        </div>

        {errorMessage ? <p className={providerStyles.noticeError} role="alert">{errorMessage}</p> : null}

        <section className={providerStyles.panel}>
          <div className={providerStyles.facts}>
            <div className={providerStyles.fact}><small>{text.category}</small><b>{view.category}</b></div>
            <div className={providerStyles.fact}><small>{text.city}</small><b>{view.city}{view.postalCode ? ` · ${view.postalCode}` : ""}</b></div>
            <div className={providerStyles.fact}><small>{text.preferredDate}</small><b>{view.preferredDate || text.notSpecified}</b></div>
          </div>
          <div className={providerStyles.description}>
            <strong>{text.description}</strong>
            <p>{view.description}</p>
          </div>
          <div className={providerStyles.panelBody}>
            <p className={providerStyles.noticeInfo}>{text.privacy}</p>

            <form method="post" action={`/api/marketplace/guest-quote/${encodeURIComponent(token)}`} className={providerStyles.form}>
              <input type="hidden" name="lang" value={locale} />

              <fieldset className={providerStyles.fieldset}>
                <legend className={providerStyles.legend}>{text.pricingLegend}</legend>
                <label className={providerStyles.radio}><input type="radio" name="priceKind" value="fixed" required /> {text.fixedPrice}</label>
                <label className={providerStyles.radio}><input type="radio" name="priceKind" value="estimate" required /> {text.estimate}</label>
                <label className={providerStyles.radio}><input type="radio" name="priceKind" value="inspection_required" required /> {text.inspectionOption}</label>
              </fieldset>

              <div className={providerStyles.field}>
                <label htmlFor="quote-amount-sek">{text.amountLabel}</label>
                <input id="quote-amount-sek" name="amountSek" inputMode="decimal" placeholder={text.amountPlaceholder} className={providerStyles.input} />
                <span className={providerStyles.helper}>{text.amountHint}</span>
              </div>

              <div className={providerStyles.field}>
                <label htmlFor="quote-available-date">{text.earliestDate}</label>
                <input id="quote-available-date" type="date" name="availableDate" className={providerStyles.input} />
              </div>

              <div className={providerStyles.field}>
                <label htmlFor="quote-company-note">{text.noteLabel}</label>
                <textarea id="quote-company-note" name="companyNote" maxLength={4000} rows={5} placeholder={text.notePlaceholder} className={providerStyles.textarea} />
              </div>

              <label className={providerStyles.consent}>
                <input type="checkbox" name="confirmAuthority" value="yes" required />
                <span>{text.authority} {view.companyName}.</span>
              </label>

              <button type="submit" className={providerStyles.primary}>{text.send}</button>
            </form>

            <p className={providerStyles.protected}>
              {text.optOutQuestion} <Link href={guestOptOutHref(token, locale)} className="underline">{text.optOutAction}</Link>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
