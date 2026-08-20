import type { Metadata } from "next";
import Link from "next/link";

import { guestFlowLocaleFrom, guestOptOutHref, guestQuoteHref, type GuestFlowLocale } from "../guest-flow-locale";
import { getMarketplaceGuestOptOutView } from "@/lib/marketplace-guest-quote";

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
  const alternativeLocale: GuestFlowLocale = locale === "en" ? "sv" : "en";
  const view = await getMarketplaceGuestOptOutView(token);
  const rawStatus = query?.status;
  const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

  if (!view) {
    return (
      <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex justify-end"><Link href={guestOptOutHref(token, alternativeLocale, status)} className="text-xs font-bold text-[#17452f]">{text.language}</Link></div>
          <h1 className="mt-4 text-3xl font-bold text-[#17201a]">{text.unavailableTitle}</h1>
          <p className="mt-4 text-[#5b665f]">{text.unavailableBody}</p>
        </section>
      </main>
    );
  }

  if (status === "dispatch_in_progress") {
    return (
      <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex justify-end"><Link href={guestOptOutHref(token, alternativeLocale, status)} className="text-xs font-bold text-[#17452f]">{text.language}</Link></div>
          <h1 className="mt-4 text-3xl font-bold text-[#17201a]">{text.dispatchTitle}</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">{text.dispatchBody}</p>
        </section>
      </main>
    );
  }

  if (status === "done" || view.status === "suppressed") {
    return (
      <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex justify-end"><Link href={guestOptOutHref(token, alternativeLocale, status)} className="text-xs font-bold text-[#17452f]">{text.language}</Link></div>
          <h1 className="mt-4 text-3xl font-bold text-[#17201a]">{text.doneTitle}</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">{text.doneBody}</p>
        </section>
      </main>
    );
  }

  return (
    <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4c745a]">Proffera</p>
          <Link href={guestOptOutHref(token, alternativeLocale, status)} className="text-xs font-bold text-[#17452f]">{text.language}</Link>
        </div>
        <h1 className="mt-3 text-3xl font-bold text-[#17201a]">{text.title}</h1>
        <p className="mt-4 leading-7 text-[#5b665f]">{text.bodyPrefix} {view.companyName}. {text.bodySuffix}</p>
        {status ? (
          <p className="mt-4 rounded-xl bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#8a2b20]" role="alert">
            {status === "rate_limited" ? text.rateLimited : text.failed}
          </p>
        ) : null}
        <form method="post" action={`/api/marketplace/guest-quote/${encodeURIComponent(token)}/opt-out`} className="mt-7">
          <input type="hidden" name="lang" value={locale} />
          <button type="submit" className="min-h-12 w-full rounded-xl bg-[#8a2b20] px-5 py-3 font-bold text-white">{text.confirm}</button>
        </form>
        <Link href={guestQuoteHref(token, locale)} className="mt-4 inline-flex text-sm font-bold text-[#17452f]">{text.back}</Link>
      </section>
    </main>
  );
}
