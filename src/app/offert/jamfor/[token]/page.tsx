import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Mail, ShieldCheck, Star } from "lucide-react";

import lifecycleStyles from "@/components/customer-lifecycle/customer-lifecycle.module.css";
import {
  getMarketplaceCustomerComparison,
  marketplaceCustomerComparisonPath,
  type MarketplaceCustomerComparisonOffer,
} from "@/lib/marketplace-customer-comparison";
import { selectMarketplaceCustomerOfferAction } from "./actions";

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
    unavailableTitle: "Länken kan inte användas",
    unavailableBody: "Jämförelselänken är ogiltig, har gått ut eller förfrågan är stängd.",
    eyebrow: "Dina offertförslag",
    title: "Jämför och välj ett företag",
    intro: "Du kan välja exakt en offert. Innan du väljer är direkta kontaktuppgifter låsta.",
    reference: "Referens",
    service: "Tjänst",
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
    contactUnlocked: "Kontaktuppgifter är nu upplåsta mellan dig och det valda företaget.",
    rejected: "Ej vald",
    selectedStatus: "Ditt val är registrerat.",
    invalid: "Valet kunde inte registreras. Ladda om sidan och försök igen.",
    rateLimited: "För många försök. Vänta en stund och försök igen.",
    alreadySelected: "En annan offert har redan valts för förfrågan.",
    closed: "Förfrågan är inte längre öppen för ett nytt val.",
    protected: "Säker personlig länk · dela inte länken med andra",
  },
  en: {
    unavailableTitle: "This link cannot be used",
    unavailableBody: "The comparison link is invalid, has expired, or the request is closed.",
    eyebrow: "Your quote offers",
    title: "Compare and choose one provider",
    intro: "You can select exactly one offer. Direct contact details stay locked until you choose.",
    reference: "Reference",
    service: "Service",
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
    contactUnlocked: "Contact details are now unlocked between you and the selected provider.",
    rejected: "Not selected",
    selectedStatus: "Your selection has been recorded.",
    invalid: "The selection could not be recorded. Reload the page and try again.",
    rateLimited: "Too many attempts. Wait a while and try again.",
    alreadySelected: "Another offer has already been selected for this request.",
    closed: "The request is no longer open for a new selection.",
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
  return suffix ? `${base}?${suffix}` : base;
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
  const rawStatus = query?.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const view = await getMarketplaceCustomerComparison(token);

  if (!view) {
    return (
      <main lang={locale} className={lifecycleStyles.page}>
        <section className={lifecycleStyles.unavailable}>
          <nav className={lifecycleStyles.languageNav} aria-label={locale === "en" ? "Language" : "Språk"}>
            <Link href={href(token, "sv", status)} className={locale === "sv" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>SV</Link>
            <Link href={href(token, "en", status)} className={locale === "en" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>EN</Link>
          </nav>
          <h1 className="mt-4">{text.unavailableTitle}</h1>
          <p>{text.unavailableBody}</p>
        </section>
      </main>
    );
  }

  const action = selectMarketplaceCustomerOfferAction.bind(null, token);
  const message = statusMessage(status, locale);
  const hasWinner = Boolean(view.selectedOfferId);

  return (
    <main lang={locale} className={lifecycleStyles.page}>
      <div className={lifecycleStyles.wideShell}>
        <div className={lifecycleStyles.topbar}>
          <div>
            <p className={lifecycleStyles.eyebrow}>{text.eyebrow}</p>
            <h1 className={lifecycleStyles.title}>{text.title}</h1>
            <p className={lifecycleStyles.lead}>{text.intro}</p>
          </div>
          <nav className={lifecycleStyles.languageNav} aria-label={locale === "en" ? "Language" : "Språk"}>
            <Link href={href(token, "sv", status)} className={locale === "sv" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>SV</Link>
            <Link href={href(token, "en", status)} className={locale === "en" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>EN</Link>
          </nav>
        </div>

        {message ? (
          <p className={status === "selected" ? lifecycleStyles.noticeSuccess : lifecycleStyles.noticeError} role={status === "selected" ? "status" : "alert"}>
            {message}
          </p>
        ) : null}

        <section className={lifecycleStyles.panel}>
          <dl className={lifecycleStyles.metaGrid}>
            <div className={lifecycleStyles.metaCell}><dt>{text.reference}</dt><dd>{view.quoteReferenceId}</dd></div>
            <div className={lifecycleStyles.metaCell}><dt>{text.service}</dt><dd>{view.serviceType} · {view.city}</dd></div>
            <div className={lifecycleStyles.metaCell}><dt>{text.preferredDate}</dt><dd>{view.preferredDate || text.notSpecified}</dd></div>
          </dl>
        </section>

        {!hasWinner ? <p className={lifecycleStyles.noticeInfo}>{text.selectionWarning}</p> : null}

        <div className={lifecycleStyles.comparisonGrid}>
          {view.offers.map((offer) => {
            const selected = offer.status === "selected";
            const rejected = offer.status === "rejected";
            return (
              <article
                key={offer.id}
                className={`${lifecycleStyles.offerCard} ${selected ? lifecycleStyles.offerSelected : ""} ${rejected ? lifecycleStyles.offerRejected : ""}`}
              >
                <div className={lifecycleStyles.offerHead}>
                  <div>
                    <h2 className={lifecycleStyles.offerName}>{offer.companyName}</h2>
                    {offer.rating === null ? (
                      <p className={lifecycleStyles.reputation}>{text.noReviews}</p>
                    ) : (
                      <p className={lifecycleStyles.reputation}>
                        <Star aria-hidden="true" />
                        <strong>{offer.rating.toFixed(1)}</strong> · {offer.reviewCount} {text.reviews}
                      </p>
                    )}
                  </div>
                  {selected ? (
                    <span className={`${lifecycleStyles.badge} ${lifecycleStyles.badgeSuccess}`}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{text.winner}</span>
                  ) : rejected ? (
                    <span className={`${lifecycleStyles.badge} ${lifecycleStyles.badgeMuted}`}>{text.rejected}</span>
                  ) : null}
                </div>

                <dl className={lifecycleStyles.offerMeta}>
                  <div><dt>{text.price}</dt><dd>{money(offer, locale)}</dd></div>
                  <div><dt>{text.available}</dt><dd>{offer.availableDate || text.notSpecified}</dd></div>
                </dl>

                <div className={lifecycleStyles.noteBlock}>
                  <strong>{text.note}</strong>
                  <p>{offer.companyNote || text.noNote}</p>
                  {offer.directContactRedacted ? <p className="text-[11px]">{text.redacted}</p> : null}
                </div>

                {selected ? (
                  <div className={lifecycleStyles.contactBox}>
                    <strong>{text.contactUnlocked}</strong>
                    {offer.providerEmail ? (
                      <p className="mt-2 flex items-center gap-2">
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        <a className="font-semibold underline" href={`mailto:${offer.providerEmail}`}>{offer.providerEmail}</a>
                      </p>
                    ) : null}
                  </div>
                ) : !hasWinner && offer.status === "submitted" ? (
                  <form action={action} className="mt-4">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <input type="hidden" name="lang" value={locale} />
                    <button type="submit" className={`${lifecycleStyles.primaryAction} w-full`}>{text.select}</button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>

        {hasWinner ? (
          <section className={lifecycleStyles.noticeSuccess}>
            <strong>{text.winnerBody}</strong>
            <p className="mt-1">{text.contactUnlocked}</p>
          </section>
        ) : null}

        <p className={lifecycleStyles.protected}><ShieldCheck aria-hidden="true" />{text.protected}</p>
      </div>
    </main>
  );
}
