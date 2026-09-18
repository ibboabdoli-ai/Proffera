import type { Metadata } from "next";
import Link from "next/link";

import {
  guestClaimHref,
  guestFlowLocaleFrom,
  guestOptOutHref,
  guestQuoteHref,
  type GuestFlowLocale,
} from "./guest-flow-locale";
import styles from "@/app/remaining-public-experience.module.css";
import { getMarketplaceGuestQuoteView } from "@/lib/marketplace-guest-quote-human-view";

export const dynamic = "force-dynamic";

const copy = {
  sv: {
    metadataTitle: "Svara på offertförfrågan", language: "English",
    unavailableTitle: "Länken kan inte användas", unavailableBody: "Förfrågan är ogiltig, har gått ut eller har stängts.",
    suppressedTitle: "Adressen är avregistrerad", suppressedBody: "Proffera skickar inte fler gästförfrågningar till den här företagsadressen.",
    responseSent: "Svar skickat", thankYou: "Tack", responseStored: "Ert svar är registrerat i Proffera och kan nu jämföras med andra svar på förfrågan.",
    price: "Pris", inspectionRequired: "Platsbesök krävs", available: "Tillgänglig", notSpecified: "Ej angivet",
    winnerTitle: "Kunden valde er offert", winnerBody: "Kontaktuppgifterna är nu upplåsta för er eftersom kunden valde just ert erbjudande.",
    contactName: "Namn", contactEmail: "E-post", contactPhone: "Telefon", contactAddress: "Adress",
    claimTitle: "Vill ni få nästa förfrågan direkt i ett eget Proffera-konto?", claimBody: "Företagsprofilen finns redan. Verifiera den för att koppla framtida offertförfrågningar till er workspace.", claimAction: "Verifiera företagsprofil",
    eyebrow: "Offertförfrågan via Proffera", inWord: "i", to: "Till", reference: "Referens", category: "Kategori", city: "Ort", preferredDate: "Önskat datum", description: "Beskrivning",
    privacy: "Kundens namn, e-post och telefonnummer delas inte innan kunden väljer att gå vidare.",
    pricingLegend: "Hur vill ni prissätta?", fixedPrice: "Fast pris", estimate: "Prisuppskattning", inspectionOption: "Platsbesök krävs innan pris kan lämnas",
    amountLabel: "Pris / uppskattning i SEK", amountPlaceholder: "t.ex. 1800", amountHint: "Lämna tomt om ni valt att platsbesök krävs.",
    earliestDate: "Tidigaste datum ni kan hjälpa kunden", noteLabel: "Kommentar till kunden", notePlaceholder: "Vad ingår, eventuella villkor eller frågor som behöver klargöras?",
    authority: "Jag bekräftar att jag får svara på förfrågan för", send: "Skicka svar",
    optOutQuestion: "Vill ni inte få fler sådana förfrågningar?", optOutAction: "Avregistrera företagsadressen",
    invalid: "Kontrollera pris och övriga uppgifter och försök igen.", rateLimited: "För många försök. Vänta en stund och försök igen.",
    expired: "Länken har gått ut.", closed: "Förfrågan är inte längre öppen.", alreadyResponded: "Ett svar har redan skickats från den här länken.",
  },
  en: {
    metadataTitle: "Respond to quote request", language: "Svenska",
    unavailableTitle: "This link cannot be used", unavailableBody: "The request is invalid, has expired, or is no longer open.",
    suppressedTitle: "This address has opted out", suppressedBody: "Proffera will not send more guest requests to this business email address.",
    responseSent: "Response sent", thankYou: "Thank you", responseStored: "Your response is registered in Proffera and can now be compared with other responses to the request.",
    price: "Price", inspectionRequired: "Site visit required", available: "Available", notSpecified: "Not specified",
    winnerTitle: "The customer selected your offer", winnerBody: "The customer's contact details are now unlocked for you because they selected your offer.",
    contactName: "Name", contactEmail: "Email", contactPhone: "Phone", contactAddress: "Address",
    claimTitle: "Would you like the next request to arrive directly in your own Proffera account?", claimBody: "The business profile already exists. Verify it to connect future quote requests to your workspace.", claimAction: "Verify business profile",
    eyebrow: "Quote request via Proffera", inWord: "in", to: "To", reference: "Reference", category: "Category", city: "Location", preferredDate: "Preferred date", description: "Description",
    privacy: "The customer's name, email address, and phone number are not shared before the customer chooses to proceed.",
    pricingLegend: "How would you like to price this?", fixedPrice: "Fixed price", estimate: "Price estimate", inspectionOption: "A site visit is required before a price can be provided",
    amountLabel: "Price / estimate in SEK", amountPlaceholder: "e.g. 1800", amountHint: "Leave blank if you selected that a site visit is required.",
    earliestDate: "Earliest date you can help the customer", noteLabel: "Comment to the customer", notePlaceholder: "What is included, any conditions, or questions that need clarification?",
    authority: "I confirm that I am authorized to respond to this request for", send: "Send response",
    optOutQuestion: "Do you not want to receive more requests like this?", optOutAction: "Opt out this business address",
    invalid: "Check the price and other details and try again.", rateLimited: "Too many attempts. Wait a while and try again.",
    expired: "The link has expired.", closed: "The request is no longer open.", alreadyResponded: "A response has already been submitted from this link.",
  },
} as const;

function money(amountMinor: number, locale: GuestFlowLocale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency", currency: "SEK",
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
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

export async function generateMetadata({ searchParams }: { searchParams?: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const query = await (searchParams ?? Promise.resolve(undefined));
  const locale = guestFlowLocaleFrom(query?.lang);
  return { title: copy[locale].metadataTitle, robots: { index: false, follow: false } };
}

export default async function MarketplaceGuestQuotePage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ status?: string | string[]; lang?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = guestFlowLocaleFrom(query?.lang);
  const text = copy[locale];
  const alternativeLocale: GuestFlowLocale = locale === "en" ? "sv" : "en";
  const view = await getMarketplaceGuestQuoteView(token);
  const rawStatus = query?.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  if (!view || view.status === "suppressed") {
    const title = view?.status === "suppressed" ? text.suppressedTitle : text.unavailableTitle;
    const body = view?.status === "suppressed" ? text.suppressedBody : text.unavailableBody;
    return (
      <main lang={locale} className={styles.page}>
        <section className={[styles.shell, styles.narrow].join(" ")}>
          <header className={styles.header}>
            <div className={styles.headerRow}>
              <div className={styles.headerCopy}><p className={styles.eyebrow}>Proffera</p><h1 className={styles.title}>{title}</h1></div>
              <Link href={guestQuoteHref(token, alternativeLocale, status)} className={styles.languageLink}>{text.language}</Link>
            </div>
          </header>
          <div className={styles.stateBody}><p className={styles.sectionCopy}>{body}</p></div>
        </section>
      </main>
    );
  }

  if (view.status === "responded" && view.offer) {
    const contact = view.customerContact;
    const contactAddress = contact ? [contact.addressLine1, contact.postalCode, contact.city].filter(Boolean).join(", ") : "";
    return (
      <main lang={locale} className={styles.page}>
        <section className={[styles.shell, styles.narrow].join(" ")}>
          <header className={styles.header}>
            <div className={styles.headerRow}>
              <div className={styles.headerCopy}>
                <p className={styles.eyebrow}>{text.responseSent}</p>
                <h1 className={styles.title}>{text.thankYou}, {view.companyName}</h1>
              </div>
              <Link href={guestQuoteHref(token, alternativeLocale, status)} className={styles.languageLink}>{text.language}</Link>
            </div>
          </header>
          <div className={styles.content}>
            <p className={styles.sectionCopy}>{text.responseStored}</p>
            <dl className={styles.facts}>
              <div className={styles.fact}><dt className={styles.label}>{text.price}</dt><dd className={styles.value}>{view.offer.priceKind === "inspection_required" ? text.inspectionRequired : money(view.offer.amountMinor, locale)}</dd></div>
              <div className={styles.fact}><dt className={styles.label}>{text.available}</dt><dd className={styles.value}>{view.offer.availableDate || text.notSpecified}</dd></div>
            </dl>
            {contact ? (
              <section className={[styles.panel, styles.panelSuccess].join(" ")}>
                <h2 className={styles.sectionTitle}>{text.winnerTitle}</h2>
                <p className={styles.sectionCopy}>{text.winnerBody}</p>
                <dl className={styles.facts} style={{ marginTop: "1rem" }}>
                  <div className={styles.fact}><dt className={styles.label}>{text.contactName}</dt><dd className={styles.value}>{contact.name || text.notSpecified}</dd></div>
                  <div className={styles.fact}><dt className={styles.label}>{text.contactEmail}</dt><dd className={styles.value}>{contact.email ? <a className={styles.link} href={`mailto:${contact.email}`}>{contact.email}</a> : text.notSpecified}</dd></div>
                  <div className={styles.fact}><dt className={styles.label}>{text.contactPhone}</dt><dd className={styles.value}>{contact.phone ? <a className={styles.link} href={`tel:${contact.phone}`}>{contact.phone}</a> : text.notSpecified}</dd></div>
                </dl>
                <p className={styles.sectionCopy}><strong>{text.contactAddress}: </strong>{contactAddress || text.notSpecified}</p>
              </section>
            ) : null}
            <section className={styles.panel}>
              <h2 className={styles.sectionTitle}>{text.claimTitle}</h2>
              <p className={styles.sectionCopy}>{text.claimBody}</p>
              <Link href={guestClaimHref(view.profileSlug, locale)} className={styles.primaryButton} style={{ marginTop: "1rem" }}>{text.claimAction}</Link>
            </section>
          </div>
        </section>
      </main>
    );
  }

  const errorMessage = statusMessage(status, locale);

  return (
    <main lang={locale} className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}>
              <p className={styles.eyebrow}>{text.eyebrow}</p>
              <h1 className={styles.title}>{view.serviceType} {text.inWord} {view.city}</h1>
              <p className={styles.intro}>{text.to} {view.companyName} · {text.reference} {view.quoteReferenceId}</p>
            </div>
            <Link href={guestQuoteHref(token, alternativeLocale, status)} className={styles.languageLink}>{text.language}</Link>
          </div>
        </header>

        <div className={styles.content}>
          {errorMessage ? <p className={[styles.notice, styles.error].join(" ")} role="alert">{errorMessage}</p> : null}
          <dl className={styles.facts}>
            <div className={styles.fact}><dt className={styles.label}>{text.category}</dt><dd className={styles.value}>{view.category}</dd></div>
            <div className={styles.fact}><dt className={styles.label}>{text.city}</dt><dd className={styles.value}>{view.city}{view.postalCode ? ` · ${view.postalCode}` : ""}</dd></div>
            <div className={styles.fact}><dt className={styles.label}>{text.preferredDate}</dt><dd className={styles.value}>{view.preferredDate || text.notSpecified}</dd></div>
          </dl>
          <section className={styles.panel}>
            <p className={styles.label}>{text.description}</p>
            <p className={styles.sectionCopy} style={{ whiteSpace: "pre-wrap" }}>{view.description}</p>
          </section>
          <p className={[styles.notice, styles.info].join(" ")}>{text.privacy}</p>

          <form method="post" action={`/api/marketplace/guest-quote/${encodeURIComponent(token)}`} className={styles.form}>
            <input type="hidden" name="lang" value={locale} />
            <fieldset className={styles.choiceGrid}>
              <legend className={styles.sectionTitle}>{text.pricingLegend}</legend>
              <label className={styles.choice}><input type="radio" name="priceKind" value="fixed" required /> {text.fixedPrice}</label>
              <label className={styles.choice}><input type="radio" name="priceKind" value="estimate" required /> {text.estimate}</label>
              <label className={styles.choice}><input type="radio" name="priceKind" value="inspection_required" required /> {text.inspectionOption}</label>
            </fieldset>
            <label className={styles.field}>{text.amountLabel}
              <input name="amountSek" inputMode="decimal" placeholder={text.amountPlaceholder} className={styles.input} />
              <span className={styles.help}>{text.amountHint}</span>
            </label>
            <label className={styles.field}>{text.earliestDate}<input type="date" name="availableDate" className={styles.input} /></label>
            <label className={styles.field}>{text.noteLabel}<textarea name="companyNote" maxLength={4000} rows={5} placeholder={text.notePlaceholder} className={styles.textarea} /></label>
            <label className={styles.consent}><input type="checkbox" name="confirmAuthority" value="yes" required /><span>{text.authority} {view.companyName}.</span></label>
            <button type="submit" className={[styles.primaryButton, styles.fullButton].join(" ")}>{text.send}</button>
          </form>
          <p className={styles.secureLine}>{text.optOutQuestion} <Link href={guestOptOutHref(token, locale)} className={styles.link}>{text.optOutAction}</Link>.</p>
        </div>
      </section>
    </main>
  );
}
