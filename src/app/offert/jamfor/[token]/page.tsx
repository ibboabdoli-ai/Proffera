import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Mail, ShieldCheck, Star } from "lucide-react";

import { selectMarketplaceCustomerOfferAction } from "./actions";
import {
  getMarketplaceCustomerComparison,
  marketplaceCustomerComparisonPath,
  type MarketplaceCustomerComparisonOffer,
} from "@/lib/marketplace-customer-comparison";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jämför offerter",
  robots: { index: false, follow: false },
};

type Locale = "sv" | "en";

const copy = {
  sv: {
    language: "English",
    unavailableTitle: "Länken kan inte användas",
    unavailableBody: "Jämförelselänken är ogiltig, har gått ut eller förfrågan är stängd.",
    eyebrow: "Dina offertförslag",
    title: "Jämför och välj ett företag",
    intro: "Du kan välja exakt en offert. Innan du väljer är direkta kontaktuppgifter låsta.",
    reference: "Referens",
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
  searchParams?: Promise<{ lang?: string | string[]; status?: string | string[] }>;
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
      <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex justify-end"><Link href={href(token, alternativeLocale, status)} className="text-xs font-bold text-[#17452f]">{text.language}</Link></div>
          <h1 className="mt-4 text-3xl font-bold text-[#17201a]">{text.unavailableTitle}</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">{text.unavailableBody}</p>
        </section>
      </main>
    );
  }

  const action = selectMarketplaceCustomerOfferAction.bind(null, token);
  const message = statusMessage(status, locale);
  const hasWinner = Boolean(view.selectedOfferId);

  return (
    <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-8 text-[#17201a] sm:px-6 sm:py-12">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-[#dfe5dd]">
        <header className="bg-[#102a1c] px-6 py-7 text-white sm:px-10 sm:py-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a9dbb9]">{text.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em]">{text.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">{text.intro}</p>
            </div>
            <Link href={href(token, alternativeLocale, status)} className="rounded-lg border border-white/35 px-3 py-2 text-xs font-bold text-white">{text.language}</Link>
          </div>
        </header>

        <div className="grid gap-7 p-6 sm:p-10">
          {message ? <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${status === "selected" ? "bg-[#edf8ef] text-[#17452f]" : "bg-[#fff4f2] text-[#8a2b20]"}`} role="status">{message}</p> : null}

          <dl className="grid gap-4 rounded-2xl border border-[#dce5da] bg-[#fafcf9] p-5 sm:grid-cols-3">
            <div><dt className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.reference}</dt><dd className="mt-1 font-semibold">{view.quoteReferenceId}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{view.serviceType}</dt><dd className="mt-1 font-semibold">{view.city}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.preferredDate}</dt><dd className="mt-1 font-semibold">{view.preferredDate || text.notSpecified}</dd></div>
          </dl>

          {!hasWinner ? <p className="rounded-xl bg-[#eef6f0] px-4 py-3 text-sm leading-6 text-[#355344]">{text.selectionWarning}</p> : null}

          <div className="grid gap-5 md:grid-cols-2">
            {view.offers.map((offer) => {
              const selected = offer.status === "selected";
              const rejected = offer.status === "rejected";
              return (
                <article key={offer.id} className={`rounded-2xl border p-5 sm:p-6 ${selected ? "border-[#8fc09c] bg-[#f2faf4]" : rejected ? "border-[#e3dfdb] bg-[#faf9f7] opacity-75" : "border-[#dce5da] bg-white"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-bold">{offer.companyName}</p>
                      {offer.rating === null ? <p className="mt-2 text-xs text-[#6b776d]">{text.noReviews}</p> : <p className="mt-2 flex items-center gap-1 text-sm text-[#58645c]"><Star className="h-4 w-4" aria-hidden="true" /> <strong>{offer.rating.toFixed(1)}</strong> · {offer.reviewCount} {text.reviews}</p>}
                    </div>
                    {selected ? <span className="inline-flex items-center gap-1 rounded-full bg-[#dff2e4] px-3 py-1 text-xs font-bold text-[#17452f]"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />{text.winner}</span> : rejected ? <span className="rounded-full bg-[#efebe7] px-3 py-1 text-xs font-bold text-[#6b625c]">{text.rejected}</span> : null}
                  </div>

                  <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div><dt className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.price}</dt><dd className="mt-1 text-lg font-extrabold text-[#173e2b]">{money(offer, locale)}</dd></div>
                    <div><dt className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.available}</dt><dd className="mt-1 font-semibold">{offer.availableDate || text.notSpecified}</dd></div>
                  </dl>

                  <div className="mt-5 border-t border-[#e1e7e2] pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.note}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#4d5b52]">{offer.companyNote || text.noNote}</p>
                    {offer.directContactRedacted ? <p className="mt-2 text-xs text-[#7a6c5b]">{text.redacted}</p> : null}
                  </div>

                  {selected ? (
                    <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-[#cfe0d2]">
                      <p className="font-bold text-[#17452f]">{text.contactUnlocked}</p>
                      {offer.providerEmail ? <p className="mt-3 flex items-center gap-2 text-sm"><Mail className="h-4 w-4" aria-hidden="true" /><a className="font-semibold underline" href={`mailto:${offer.providerEmail}`}>{offer.providerEmail}</a></p> : null}
                    </div>
                  ) : !hasWinner && offer.status === "submitted" ? (
                    <form action={action} className="mt-5">
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="lang" value={locale} />
                      <button type="submit" className="min-h-12 w-full rounded-xl bg-[#17452f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#103822]">{text.select}</button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>

          {hasWinner ? <section className="rounded-2xl bg-[#edf8ef] p-5 text-[#17452f]"><h2 className="font-bold">{text.winnerBody}</h2><p className="mt-2 text-sm leading-6">{text.contactUnlocked}</p></section> : null}

          <p className="flex items-center justify-center gap-2 text-xs text-[#6b776d]"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{text.protected}</p>
        </div>
      </section>
    </main>
  );
}
