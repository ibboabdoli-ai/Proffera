import type { Metadata } from "next";
import Link from "next/link";

import {
  guestClaimHref,
  guestFlowLocaleFrom,
  guestOptOutHref,
  guestQuoteHref,
  type GuestFlowLocale,
} from "./guest-flow-locale";
import { getMarketplaceGuestQuoteView } from "@/lib/marketplace-guest-quote";

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
  const alternativeLocale: GuestFlowLocale = locale === "en" ? "sv" : "en";
  const view = await getMarketplaceGuestQuoteView(token);
  const rawStatus = query?.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  if (!view) {
    return (
      <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex justify-end"><Link href={guestQuoteHref(token, alternativeLocale, status)} className="text-xs font-bold text-[#17452f]">{text.language}</Link></div>
          <h1 className="mt-4 text-3xl font-bold text-[#17201a]">{text.unavailableTitle}</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">{text.unavailableBody}</p>
        </section>
      </main>
    );
  }

  if (view.status === "suppressed") {
    return (
      <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex justify-end"><Link href={guestQuoteHref(token, alternativeLocale, status)} className="text-xs font-bold text-[#17452f]">{text.language}</Link></div>
          <h1 className="mt-4 text-3xl font-bold text-[#17201a]">{text.suppressedTitle}</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">{text.suppressedBody}</p>
        </section>
      </main>
    );
  }

  if (view.status === "responded" && view.offer) {
    return (
      <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6">
        <section className="mx-auto max-w-2xl rounded-3xl bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd] sm:p-10">
          <div className="flex justify-end"><Link href={guestQuoteHref(token, alternativeLocale, status)} className="text-xs font-bold text-[#17452f]">{text.language}</Link></div>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-[#4c745a]">{text.responseSent}</p>
          <h1 className="mt-3 text-3xl font-bold text-[#17201a]">{text.thankYou}, {view.companyName}</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">{text.responseStored}</p>
          <dl className="mt-7 grid gap-4 rounded-2xl bg-[#f7f9f7] p-5 sm:grid-cols-2">
            <div><dt className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.price}</dt><dd className="mt-1 text-lg font-bold">{view.offer.priceKind === "inspection_required" ? text.inspectionRequired : money(view.offer.amountMinor, locale)}</dd></div>
            <div><dt className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.available}</dt><dd className="mt-1 font-semibold">{view.offer.availableDate || text.notSpecified}</dd></div>
          </dl>
          <div className="mt-8 rounded-2xl border border-[#dce5da] p-5">
            <h2 className="font-bold text-[#17201a]">{text.claimTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5b665f]">{text.claimBody}</p>
            <Link href={guestClaimHref(view.profileSlug, locale)} className="mt-4 inline-flex rounded-xl bg-[#17452f] px-4 py-3 text-sm font-bold text-white">{text.claimAction}</Link>
          </div>
        </section>
      </main>
    );
  }

  const errorMessage = statusMessage(status, locale);

  return (
    <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-8 text-[#17201a] sm:px-6 sm:py-12">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-[#dfe5dd]">
        <header className="bg-[#102a1c] px-6 py-7 text-white sm:px-10 sm:py-9">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a9dbb9]">{text.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em]">{view.serviceType} {text.inWord} {view.city}</h1>
            </div>
            <Link href={guestQuoteHref(token, alternativeLocale, status)} className="rounded-lg border border-white/35 px-3 py-2 text-xs font-bold text-white">{text.language}</Link>
          </div>
          <p className="mt-3 text-sm text-white/80">{text.to} {view.companyName} · {text.reference} {view.quoteReferenceId}</p>
        </header>

        <div className="grid gap-7 p-6 sm:p-10">
          {errorMessage ? <p className="rounded-xl bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#8a2b20]" role="alert">{errorMessage}</p> : null}

          <section className="rounded-2xl border border-[#dce5da] bg-[#fafcf9] p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><p className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.category}</p><p className="mt-1 font-semibold">{view.category}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.city}</p><p className="mt-1 font-semibold">{view.city}{view.postalCode ? ` · ${view.postalCode}` : ""}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.preferredDate}</p><p className="mt-1 font-semibold">{view.preferredDate || text.notSpecified}</p></div>
            </div>
            <div className="mt-5 border-t border-[#dce5da] pt-5"><p className="text-xs font-bold uppercase tracking-wide text-[#6b776d]">{text.description}</p><p className="mt-2 whitespace-pre-wrap leading-7 text-[#455148]">{view.description}</p></div>
          </section>

          <p className="rounded-xl bg-[#eef6f0] px-4 py-3 text-sm text-[#355344]">{text.privacy}</p>

          <form method="post" action={`/api/marketplace/guest-quote/${encodeURIComponent(token)}`} className="grid gap-5">
            <input type="hidden" name="lang" value={locale} />
            <fieldset className="grid gap-3">
              <legend className="font-bold">{text.pricingLegend}</legend>
              <label className="flex items-center gap-3"><input type="radio" name="priceKind" value="fixed" required /> {text.fixedPrice}</label>
              <label className="flex items-center gap-3"><input type="radio" name="priceKind" value="estimate" required /> {text.estimate}</label>
              <label className="flex items-center gap-3"><input type="radio" name="priceKind" value="inspection_required" required /> {text.inspectionOption}</label>
            </fieldset>

            <label className="grid gap-2 text-sm font-bold">{text.amountLabel}
              <input name="amountSek" inputMode="decimal" placeholder={text.amountPlaceholder} className="min-h-12 rounded-xl border border-[#cdd8cf] px-4 font-normal" />
              <span className="text-xs font-normal text-[#6b776d]">{text.amountHint}</span>
            </label>

            <label className="grid gap-2 text-sm font-bold">{text.earliestDate}
              <input type="date" name="availableDate" className="min-h-12 rounded-xl border border-[#cdd8cf] px-4 font-normal" />
            </label>

            <label className="grid gap-2 text-sm font-bold">{text.noteLabel}
              <textarea name="companyNote" maxLength={4000} rows={5} placeholder={text.notePlaceholder} className="rounded-xl border border-[#cdd8cf] p-4 font-normal" />
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-[#dce5da] p-4 text-sm leading-6">
              <input type="checkbox" name="confirmAuthority" value="yes" required className="mt-1" />
              <span>{text.authority} {view.companyName}.</span>
            </label>

            <button type="submit" className="min-h-12 rounded-xl bg-[#17452f] px-5 py-3 font-bold text-white">{text.send}</button>
          </form>

          <p className="text-center text-xs text-[#6b776d]">{text.optOutQuestion} <Link href={guestOptOutHref(token, locale)} className="underline">{text.optOutAction}</Link>.</p>
        </div>
      </section>
    </main>
  );
}
