import type { Metadata } from "next";
import Link from "next/link";

import { getMarketplaceCustomerComparison } from "@/lib/marketplace-customer-comparison";
import { getMarketplaceRematchForCustomerToken } from "@/lib/marketplace-rematch";
import { getMarketplaceServiceJobForCustomerToken } from "@/lib/marketplace-service-jobs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ditt Marketplace-jobb | Proffera",
  robots: { index: false, follow: false },
};

type Locale = "sv" | "en";
function localeFrom(value: string | string[] | undefined): Locale {
  return Array.isArray(value) ? (value[0] === "en" ? "en" : "sv") : value === "en" ? "en" : "sv";
}

const copy = {
  sv: {
    language: "English",
    unavailable: "Jobbet är inte tillgängligt.",
    eyebrow: "Ditt valda företag",
    title: "Följ jobbet",
    provider: "Företag",
    providerContact: "Företagets kontakt",
    status: "Status",
    service: "Tjänst",
    date: "Planerat datum",
    price: "Överenskommet pris",
    cancelTitle: "Behöver du avbryta?",
    cancelBody: "En avbokning väljer aldrig automatiskt en annan offert. Om du vill hitta ett nytt företag behöver förfrågan matchas om.",
    reason: "Anledning",
    cancel: "Avbryt jobbet",
    rematchTitle: "Behöver du ett nytt företag?",
    rematchBody: "Proffera skapar en ny sökomgång. Det gamla jobbet och den gamla vinnaren sparas som historik och ingen tidigare offert blir automatiskt vald.",
    rematch: "Hitta ett nytt företag",
    rematchPending: "En ny matchning är redan beställd och väntar på behandling.",
    rematchProcessing: "Proffera söker nu efter nya företag.",
    rematchProcessed: "Den nya matchningen har startat. Du får en ny jämförelselänk när nya offerter kommer in.",
    completed: "Jobbet är markerat som slutfört. När omdömesinbjudan skickas kan du lämna ett verifierat omdöme.",
    protected: "Säker personlig jobblänk · dela inte länken",
  },
  en: {
    language: "Svenska",
    unavailable: "This job is not available.",
    eyebrow: "Your selected provider",
    title: "Track the job",
    provider: "Provider",
    providerContact: "Provider contact",
    status: "Status",
    service: "Service",
    date: "Scheduled date",
    price: "Agreed price",
    cancelTitle: "Need to cancel?",
    cancelBody: "Cancelling never silently promotes another offer. If you need a new provider, the request must be rematched.",
    reason: "Reason",
    cancel: "Cancel job",
    rematchTitle: "Need a new provider?",
    rematchBody: "Proffera creates a new matching round. The previous job and winner remain as history and no previous offer is automatically selected.",
    rematch: "Find a new provider",
    rematchPending: "A new matching round has already been requested and is waiting to be processed.",
    rematchProcessing: "Proffera is now searching for new providers.",
    rematchProcessed: "The new matching round has started. You will receive a new comparison link when new offers arrive.",
    completed: "The job is marked completed. When the review invitation is delivered, you can leave a verified review.",
    protected: "Secure personal job link · do not share it",
  },
} as const;

function actionMessage(value: string | undefined, locale: Locale) {
  const sv = locale === "sv";
  if (value === "customer_cancelled") return sv ? "Jobbet har avbrutits." : "The job has been cancelled.";
  if (value === "requested") return sv ? "En ny matchning har beställts." : "A new matching round has been requested.";
  if (value === "already_requested") return sv ? "En ny matchning är redan beställd." : "A new matching round has already been requested.";
  if (value === "rate_limited") return sv ? "För många försök. Vänta en stund och försök igen." : "Too many attempts. Wait a while and try again.";
  if (value === "not_eligible") return sv ? "Jobbet kan inte matchas om i sin nuvarande status." : "This job cannot be rematched in its current status.";
  if (value === "invalid" || value === "unavailable") return sv ? "Den säkra jobblänken kan inte användas för åtgärden." : "The secure job link cannot be used for this action.";
  if (value === "database" || value === "transition") return sv ? "Åtgärden kunde inte sparas just nu. Försök igen." : "The action could not be saved right now. Try again.";
  return "";
}

function money(amountMinor: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency",
    currency: currency || "SEK",
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

export default async function MarketplaceCustomerJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[]; status?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = localeFrom(query?.lang);
  const text = copy[locale];
  const [job, comparison, rematch] = await Promise.all([
    getMarketplaceServiceJobForCustomerToken(token),
    getMarketplaceCustomerComparison(token),
    getMarketplaceRematchForCustomerToken(token),
  ]);
  const selected = comparison?.offers.find((offer) => offer.status === "selected") ?? null;

  if (!job || !selected) {
    return <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16"><p className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center">{text.unavailable}</p></main>;
  }

  const alternative = locale === "en" ? "sv" : "en";
  const rawActionStatus = query?.status;
  const actionStatus = Array.isArray(rawActionStatus) ? rawActionStatus[0] : rawActionStatus;
  const languageParams = new URLSearchParams();
  if (alternative === "en") languageParams.set("lang", "en");
  if (actionStatus) languageParams.set("status", actionStatus);
  const languageQuery = languageParams.toString();
  const languageHref = `/offert/jobb/kund/${encodeURIComponent(token)}${languageQuery ? `?${languageQuery}` : ""}`;
  const feedback = actionMessage(actionStatus, locale);
  const cancellable = job.status === "accepted" || job.status === "in_progress" || job.status === "problem";
  const rematchEligible = ["customer_cancelled", "provider_cancelled", "no_show", "problem"].includes(job.status);
  const action = `/api/marketplace/customer-service-job/${encodeURIComponent(token)}`;
  const rematchMessage = rematch?.status === "processing"
    ? text.rematchProcessing
    : rematch?.status === "processed"
      ? text.rematchProcessed
      : rematch
        ? text.rematchPending
        : "";

  return (
    <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-8 text-[#17201a] sm:px-6 sm:py-12">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-[#dfe5dd]">
        <header className="bg-[#102a1c] px-6 py-7 text-white sm:px-10">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a9dbb9]">{text.eyebrow}</p><h1 className="mt-3 text-3xl font-bold">{text.title}</h1></div>
            <Link href={languageHref} className="rounded-lg border border-white/35 px-3 py-2 text-xs font-bold text-white">{text.language}</Link>
          </div>
        </header>

        <div className="grid gap-6 p-6 sm:p-10">
          {feedback ? <p role="status" className="rounded-xl border border-[#a9cdb2] bg-[#edf8ef] px-4 py-3 text-sm font-semibold text-[#17452f]">{feedback}</p> : null}

          <section className="rounded-2xl border border-[#a9cdb2] bg-[#edf8ef] p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-[#4c745a]">{text.provider}</p>
            <h2 className="mt-1 text-xl font-bold text-[#17452f]">{selected.companyName}</h2>
            {selected.providerEmail ? <p className="mt-3 text-sm"><span className="font-bold">{text.providerContact}: </span><a className="underline" href={`mailto:${selected.providerEmail}`}>{selected.providerEmail}</a></p> : null}
          </section>

          <dl className="grid gap-4 rounded-2xl bg-[#f7f9f7] p-5 sm:grid-cols-2">
            <div><dt className="text-xs font-bold uppercase text-[#6b776d]">{text.status}</dt><dd className="mt-1 font-bold">{job.status}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-[#6b776d]">{text.service}</dt><dd className="mt-1 font-semibold">{job.serviceName}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-[#6b776d]">{text.date}</dt><dd className="mt-1 font-semibold">{job.scheduledDate || "—"}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-[#6b776d]">{text.price}</dt><dd className="mt-1 font-semibold">{money(job.amountMinor, job.currency, locale)}</dd></div>
          </dl>

          {job.status === "completed" ? <p className="rounded-2xl bg-[#edf8ef] p-5 text-sm leading-6 text-[#17452f]">{text.completed}</p> : null}

          {cancellable ? (
            <section className="rounded-2xl border border-[#efd0cb] p-5">
              <h2 className="font-bold text-[#8a2b20]">{text.cancelTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6b625c]">{text.cancelBody}</p>
              <form action={action} method="post" className="mt-4 grid gap-3">
                <input type="hidden" name="lang" value={locale} />
                <input type="hidden" name="intent" value="cancel" />
                <label className="grid gap-2 text-sm font-bold">{text.reason}<textarea name="reason" maxLength={1000} rows={3} className="rounded-xl border p-3 font-normal" /></label>
                <button type="submit" className="min-h-11 rounded-xl bg-[#8a2b20] px-4 py-2 font-bold text-white">{text.cancel}</button>
              </form>
            </section>
          ) : null}

          {rematchEligible ? (
            <section className="rounded-2xl border border-[#c9d9f1] bg-[#f3f7fd] p-5">
              <h2 className="font-bold text-[#214b7a]">{text.rematchTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[#536579]">{text.rematchBody}</p>
              {rematch ? (
                <p className="mt-4 rounded-xl bg-white p-4 text-sm font-semibold text-[#214b7a]">{rematchMessage}</p>
              ) : (
                <form action={action} method="post" className="mt-4 grid gap-3">
                  <input type="hidden" name="lang" value={locale} />
                  <input type="hidden" name="intent" value="rematch" />
                  <label className="grid gap-2 text-sm font-bold">{text.reason}<textarea name="reason" maxLength={1000} rows={3} className="rounded-xl border p-3 font-normal" /></label>
                  <button type="submit" className="min-h-11 rounded-xl bg-[#214b7a] px-4 py-2 font-bold text-white">{text.rematch}</button>
                </form>
              )}
            </section>
          ) : null}

          <p className="text-center text-xs text-[#6b776d]">{text.protected}</p>
        </div>
      </section>
    </main>
  );
}
