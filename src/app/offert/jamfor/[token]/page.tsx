import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Mail, ShieldCheck, Star } from "lucide-react";

import { selectMarketplaceCustomerOfferAction } from "./actions";
import styles from "@/app/public-customer-lifecycle.module.css";
import {
  getMarketplaceCustomerComparison,
  marketplaceCustomerComparisonPath,
  type MarketplaceCustomerComparisonOffer,
} from "@/lib/marketplace-customer-comparison";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";

type ComparisonSearchParams = {
  lang?: string | string[];
  status?: string | string[];
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<ComparisonSearchParams>;
}): Promise<Metadata> {
  const query = await (searchParams ?? Promise.resolve(undefined));
  const locale = localeFrom(query?.lang);
  return {
    title: locale === "en" ? "Compare offers" : "Jämför offerter",
    robots: { index: false, follow: false },
  };
}

const copy = {
  sv: {
    language: "English",
    unavailableTitle: "Länken kan inte användas",
    unavailableBody: "Jämförelselänken är ogiltig, har gått ut eller förfrågan är stängd.",
    eyebrow: "Dina offertförslag",
    title: "Jämför och välj ett företag",
    intro: "Du kan välja exakt en offert. Innan du väljer är direkta kontaktuppgifter låsta.",
    reference: "Referens",
    serviceAndLocation: "Tjänst och plats",
    preferredDate: "Önskat datum",
    price: "Pris",
    inspection: "Platsbesök krävs",
    available: "Tidigaste datum",
    notSpecified: "Ej angivet",
    reviews: "verifierade omdömen",
    noReviews: "Inga verifierade omdömen ännu",
    note: "Företagets kommentar",
    noNote: "Ingen kommentar lämnades.",
    redacted: "Direkta kontaktuppgifter i kommentaren visas först efter ditt val.",
    select: "Välj denna offert",
    selectionWarning: "När du väljer låses dina nödvändiga kontaktuppgifter upp endast för det valda företaget. Övriga offerter stängs.",
    winner: "Vald offert",
    winnerBody: "Du har valt detta företag. De andra offertförslagen är stängda.",
    providerContact: "Företagets kontakt",
    contactUnlocked: "Kontaktuppgifter är nu upplåsta mellan dig och det valda företaget.",
    rejected: "Ej vald",
    selectedStatus: "Ditt val är registrerat.",
    invalid: "Valet kunde inte registreras. Ladda om sidan och försök igen.",
    rateLimited: "För många försök. Vänta en stund och försök igen.",
    alreadySelected: "En annan offert har redan valts för förfrågan.",
    closed: "Förfrågan är inte längre öppen för ett nytt val.",
    emptyTitle: "Inga offerter att visa ännu",
    emptyBody: "När ett företag har lämnat ett förslag visas det här i din säkra jämförelse.",
    protected: "Säker personlig länk · dela inte länken med andra",
  },
  en: {
    language: "Svenska",
    unavailableTitle: "This link cannot be used",
    unavailableBody: "The comparison link is invalid, has expired, or the request is closed.",
    eyebrow: "Your quote offers",
    title: "Compare and choose one provider",
    intro: "You can select exactly one offer. Direct contact details stay locked until you choose.",
    reference: "Reference",
    serviceAndLocation: "Service and location",
    preferredDate: "Preferred date",
    price: "Price",
    inspection: "Site visit required",
    available: "Earliest date",
    notSpecified: "Not specified",
    reviews: "verified reviews",
    noReviews: "No verified reviews yet",
    note: "Company note",
    noNote: "No note was provided.",
    redacted: "Direct contact details in the note are shown only after your selection.",
    select: "Choose this offer",
    selectionWarning: "When you choose, the required contact details are unlocked only for the selected provider. All other offers are closed.",
    winner: "Selected offer",
    winnerBody: "You selected this provider. The other offers are now closed.",
    providerContact: "Company contact",
    contactUnlocked: "Contact details are now unlocked between you and the selected provider.",
    rejected: "Not selected",
    selectedStatus: "Your selection has been recorded.",
    invalid: "The selection could not be recorded. Reload the page and try again.",
    rateLimited: "Too many attempts. Wait a while and try again.",
    alreadySelected: "Another offer has already been selected for this request.",
    closed: "The request is no longer open for a new selection.",
    emptyTitle: "No offers to show yet",
    emptyBody: "When a provider submits an offer, it will appear here in your secure comparison.",
    protected: "Secure personal link · do not share this link",
  },
} as const;

function localeFrom(value: string | string[] | undefined): Locale {
  return Array.isArray(value) ? (value[0] === "en" ? "en" : "sv") : value === "en" ? "en" : "sv";
}

function href(token: string, locale: Locale, status?: string) {
  const query = new URLSearchParams();
  if (locale === "en") query.set("lang", "en");
  if (status) query.set("status", status);
  const suffix = query.toString();
  const base = marketplaceCustomerComparisonPath(token);
  return suffix ? base + "?" + suffix : base;
}

function money(offer: MarketplaceCustomerComparisonOffer, locale: Locale) {
  if (offer.priceKind === "inspection_required") return copy[locale].inspection;
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency",
    currency: offer.currency || "SEK",
    minimumFractionDigits: offer.amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(offer.amountMinor / 100);
}

function statusMessage(status: string | undefined, locale: Locale) {
  const text = copy[locale];
  if (status === "selected") return text.selectedStatus;
  if (status === "rate_limited") return text.rateLimited;
  if (status === "already_selected") return text.alreadySelected;
  if (status === "closed") return text.closed;
  if (status === "invalid") return text.invalid;
  return "";
}

export default async function MarketplaceCustomerComparisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<ComparisonSearchParams>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = localeFrom(query?.lang);
  const text = copy[locale];
  const alternativeLocale: Locale = locale === "en" ? "sv" : "en";
  const rawStatus = query?.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const view = await getMarketplaceCustomerComparison(token);

  if (!view) {
    return (
      <main lang={locale} className={styles.page}>
        <section className={[styles.frame, styles.narrowFrame].join(" ")}>
          <header className={styles.header}>
            <div className={styles.headerRow}>
              <div className={styles.headerCopy}>
                <p className={styles.eyebrow}>{text.eyebrow}</p>
                <h1 className={styles.title}>{text.unavailableTitle}</h1>
              </div>
              <Link href={href(token, alternativeLocale, status)} className={styles.languageLink}>
                {text.language}
              </Link>
            </div>
          </header>
          <div className={styles.stateBody}>
            <p className={styles.reviewLead}>{text.unavailableBody}</p>
          </div>
        </section>
      </main>
    );
  }

  const action = selectMarketplaceCustomerOfferAction.bind(null, token);
  const message = statusMessage(status, locale);
  const hasWinner = Boolean(view.selectedOfferId);
  const hasOffers = view.offers.length > 0;
  const messageIsSuccess = status === "selected";

  return (
    <main lang={locale} className={styles.page}>
      <section className={styles.frame}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}>
              <p className={styles.eyebrow}>{text.eyebrow}</p>
              <h1 className={styles.title}>{text.title}</h1>
              <p className={styles.intro}>{text.intro}</p>
            </div>
            <Link href={href(token, alternativeLocale, status)} className={styles.languageLink}>
              {text.language}
            </Link>
          </div>
        </header>

        <div className={styles.content}>
          {message ? (
            <p
              className={[styles.notice, messageIsSuccess ? styles.noticeSuccess : styles.noticeError].join(" ")}
              role={messageIsSuccess ? "status" : "alert"}
            >
              {message}
            </p>
          ) : null}

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{text.reference}</dt>
              <dd className={styles.factValue}>{view.quoteReferenceId}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{text.serviceAndLocation}</dt>
              <dd className={styles.factValue}>{view.serviceType} · {view.city}</dd>
            </div>
            <div className={styles.fact}>
              <dt className={styles.factLabel}>{text.preferredDate}</dt>
              <dd className={styles.factValue}>{view.preferredDate || text.notSpecified}</dd>
            </div>
          </dl>

          {hasOffers && !hasWinner ? (
            <p className={[styles.notice, styles.noticeInfo].join(" ")}>{text.selectionWarning}</p>
          ) : null}

          {!hasOffers ? (
            <section className={styles.emptyPanel}>
              <h2 className={styles.emptyTitle}>{text.emptyTitle}</h2>
              <p className={styles.emptyBody}>{text.emptyBody}</p>
            </section>
          ) : (
            <div className={styles.offerGrid}>
              {view.offers.map((offer) => {
                const selected = offer.status === "selected";
                const rejected = offer.status === "rejected";
                const cardClass = [
                  styles.offerCard,
                  selected ? styles.offerSelected : "",
                  rejected ? styles.offerRejected : "",
                ].filter(Boolean).join(" ");

                return (
                  <article key={offer.id} className={cardClass}>
                    <div className={styles.offerHeader}>
                      <div>
                        <h2 className={styles.offerName}>{offer.companyName}</h2>
                        {offer.rating === null ? (
                          <p className={styles.rating}>{text.noReviews}</p>
                        ) : (
                          <p className={styles.rating}>
                            <Star className="h-4 w-4" aria-hidden="true" />
                            <strong>{offer.rating.toFixed(1)}</strong> · {offer.reviewCount} {text.reviews}
                          </p>
                        )}
                      </div>
                      {selected ? (
                        <span className={[styles.statusBadge, styles.statusSuccess].join(" ")}>
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          {text.winner}
                        </span>
                      ) : rejected ? (
                        <span className={[styles.statusBadge, styles.statusMuted].join(" ")}>
                          {text.rejected}
                        </span>
                      ) : null}
                    </div>

                    <dl className={styles.facts} style={{ marginTop: "1rem" }}>
                      <div className={styles.fact}>
                        <dt className={styles.factLabel}>{text.price}</dt>
                        <dd className={styles.factValue}>{money(offer, locale)}</dd>
                      </div>
                      <div className={styles.fact}>
                        <dt className={styles.factLabel}>{text.available}</dt>
                        <dd className={styles.factValue}>{offer.availableDate || text.notSpecified}</dd>
                      </div>
                    </dl>

                    <div className={styles.cardSection}>
                      <p className={styles.factLabel}>{text.note}</p>
                      <p className={styles.panelBody}>{offer.companyNote || text.noNote}</p>
                      {offer.directContactRedacted ? <p className={styles.emptyBody}>{text.redacted}</p> : null}
                    </div>

                    {selected ? (
                      <div className={styles.contactPanel}>
                        <p className={styles.sectionTitle}>{text.contactUnlocked}</p>
                        {offer.providerEmail ? (
                          <p className={styles.sectionCopy}>
                            <Mail className="mr-2 inline h-4 w-4" aria-hidden="true" />
                            <a className="font-semibold underline" href={"mailto:" + offer.providerEmail}>
                              {offer.providerEmail}
                            </a>
                          </p>
                        ) : null}
                      </div>
                    ) : !hasWinner && offer.status === "submitted" ? (
                      <form action={action} style={{ marginTop: "1rem" }}>
                        <input type="hidden" name="offerId" value={offer.id} />
                        <input type="hidden" name="lang" value={locale} />
                        <button type="submit" className={styles.primaryButton} style={{ width: "100%" }}>
                          {text.select}
                        </button>
                      </form>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          {hasWinner ? (
            <section className={[styles.notice, styles.noticeSuccess].join(" ")}>
              <h2 className={styles.sectionTitle}>{text.winnerBody}</h2>
              <p className={styles.sectionCopy}>{text.contactUnlocked}</p>
            </section>
          ) : null}

          <p className={styles.secureLine}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {text.protected}
          </p>
        </div>
      </section>
    </main>
  );
}
