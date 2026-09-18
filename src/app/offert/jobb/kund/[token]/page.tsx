import type { Metadata } from "next";
import Link from "next/link";

import lifecycleStyles from "@/components/customer-lifecycle/customer-lifecycle.module.css";
import { getMarketplaceCustomerComparison } from "@/lib/marketplace-customer-comparison";
import { getMarketplaceRematchForCustomerToken } from "@/lib/marketplace-rematch";
import { getMarketplaceServiceJobForCustomerToken } from "@/lib/marketplace-service-jobs";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";
type ActionFeedback = { text: string; severity: "success" | "error" } | null;

function localeFrom(value: string | string[] | undefined): Locale {
  return Array.isArray(value) ? (value[0] === "en" ? "en" : "sv") : value === "en" ? "en" : "sv";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const query = await (searchParams ?? Promise.resolve(undefined));
  const locale = localeFrom(query?.lang);
  return {
    title: locale === "en" ? "Your Marketplace job | Proffera" : "Ditt Marketplace-jobb | Proffera",
    robots: { index: false, follow: false },
  };
}

const copy = {
  sv: {
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
    rematchCancelled: "Den nya matchningen har avbrutits. Kontakta Proffera om du fortfarande behöver ett nytt företag.",
    completed: "Jobbet är markerat som slutfört. När omdömesinbjudan skickas kan du lämna ett verifierat omdöme.",
    protected: "Säker personlig jobblänk · dela inte länken",
  },
  en: {
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
    rematchCancelled: "The new matching round was cancelled. Contact Proffera if you still need a new provider.",
    completed: "The job is marked completed. When the review invitation is delivered, you can leave a verified review.",
    protected: "Secure personal job link · do not share it",
  },
} as const;

function actionMessage(value: string | undefined, locale: Locale): ActionFeedback {
  const sv = locale === "sv";
  if (value === "customer_cancelled") return { text: sv ? "Jobbet har avbrutits." : "The job has been cancelled.", severity: "success" };
  if (value === "requested") return { text: sv ? "En ny matchning har beställts." : "A new matching round has been requested.", severity: "success" };
  if (value === "already_requested") return { text: sv ? "En ny matchning är redan beställd." : "A new matching round has already been requested.", severity: "success" };
  if (value === "rematch_requested") return { text: sv ? "Åtgärden avvisades eftersom en ny matchning redan har beställts." : "The action was rejected because a new matching round has already been requested.", severity: "error" };
  if (value === "closed") return { text: sv ? "Jobbet är redan avslutat och kan inte längre avbrytas." : "The job is already closed and can no longer be cancelled.", severity: "error" };
  if (value === "rate_limited") return { text: sv ? "För många försök. Vänta en stund och försök igen." : "Too many attempts. Wait a while and try again.", severity: "error" };
  if (value === "not_eligible") return { text: sv ? "Jobbet kan inte matchas om i sin nuvarande status." : "This job cannot be rematched in its current status.", severity: "error" };
  if (value === "invalid" || value === "unavailable") return { text: sv ? "Den säkra jobblänken kan inte användas för åtgärden." : "The secure job link cannot be used for this action.", severity: "error" };
  if (value === "database" || value === "transition") return { text: sv ? "Åtgärden kunde inte sparas just nu. Försök igen." : "The action could not be saved right now. Try again.", severity: "error" };
  return null;
}

function jobStatusLabel(status: string, locale: Locale) {
  const labels: Record<Locale, Record<string, string>> = {
    sv: {
      accepted: "Accepterat",
      in_progress: "Pågår",
      completed: "Slutfört",
      provider_cancelled: "Avbrutet av företaget",
      customer_cancelled: "Avbrutet av kunden",
      no_show: "Företaget uteblev",
      problem: "Problem rapporterat",
    },
    en: {
      accepted: "Accepted",
      in_progress: "In progress",
      completed: "Completed",
      provider_cancelled: "Cancelled by provider",
      customer_cancelled: "Cancelled by customer",
      no_show: "Provider no-show",
      problem: "Problem reported",
    },
  };
  return labels[locale][status] ?? (locale === "en" ? "Unknown status" : "Okänd status");
}

function money(amountMinor: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency",
    currency: currency || "SEK",
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

function pageHref(token: string, locale: Locale, status?: string) {
  const query = new URLSearchParams();
  if (locale === "en") query.set("lang", "en");
  if (status) query.set("status", status);
  const suffix = query.toString();
  return `/offert/jobb/kund/${encodeURIComponent(token)}${suffix ? `?${suffix}` : ""}`;
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
    return (
      <main lang={locale} className={lifecycleStyles.page}>
        <section className={lifecycleStyles.unavailable}>
          <nav className={lifecycleStyles.languageNav} aria-label={locale === "en" ? "Language" : "Språk"}>
            <Link href={pageHref(token, "sv")} className={locale === "sv" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>SV</Link>
            <Link href={pageHref(token, "en")} className={locale === "en" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>EN</Link>
          </nav>
          <h1 className="mt-4">{text.unavailable}</h1>
        </section>
      </main>
    );
  }

  const rawActionStatus = query?.status;
  const actionStatus = Array.isArray(rawActionStatus) ? rawActionStatus[0] : rawActionStatus;
  const feedback = actionMessage(actionStatus, locale);
  const cancellable = job.status === "accepted" || job.status === "in_progress" || job.status === "problem";
  const rematchEligible = ["customer_cancelled", "provider_cancelled", "no_show", "problem"].includes(job.status);
  const action = `/api/marketplace/customer-service-job/${encodeURIComponent(token)}`;
  const rematchMessage = rematch?.status === "processing"
    ? text.rematchProcessing
    : rematch?.status === "processed"
      ? text.rematchProcessed
      : rematch?.status === "cancelled"
        ? text.rematchCancelled
        : rematch
          ? text.rematchPending
          : "";

  return (
    <main lang={locale} className={lifecycleStyles.page}>
      <div className={lifecycleStyles.shell}>
        <div className={lifecycleStyles.topbar}>
          <div>
            <p className={lifecycleStyles.eyebrow}>{text.eyebrow}</p>
            <h1 className={lifecycleStyles.title}>{text.title}</h1>
          </div>
          <nav className={lifecycleStyles.languageNav} aria-label={locale === "en" ? "Language" : "Språk"}>
            <Link href={pageHref(token, "sv", actionStatus)} className={locale === "sv" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>SV</Link>
            <Link href={pageHref(token, "en", actionStatus)} className={locale === "en" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>EN</Link>
          </nav>
        </div>

        {feedback ? (
          <p role={feedback.severity === "error" ? "alert" : "status"} className={feedback.severity === "error" ? lifecycleStyles.noticeError : lifecycleStyles.noticeSuccess}>
            {feedback.text}
          </p>
        ) : null}

        <section className={lifecycleStyles.panel}>
          <div className={lifecycleStyles.panelBody}>
            <div className={lifecycleStyles.jobProvider}>
              <p className={lifecycleStyles.eyebrow}>{text.provider}</p>
              <h2>{selected.companyName}</h2>
              {selected.providerEmail ? (
                <p className="mt-2 text-sm">
                  <strong>{text.providerContact}: </strong>
                  <a className="underline" href={`mailto:${selected.providerEmail}`}>{selected.providerEmail}</a>
                </p>
              ) : null}
            </div>

            <dl className={lifecycleStyles.jobInfo}>
              <div><dt>{text.status}</dt><dd>{jobStatusLabel(job.status, locale)}</dd></div>
              <div><dt>{text.service}</dt><dd>{job.serviceName}</dd></div>
              <div><dt>{text.date}</dt><dd>{job.scheduledDate || "—"}</dd></div>
              <div><dt>{text.price}</dt><dd>{money(job.amountMinor, job.currency, locale)}</dd></div>
            </dl>

            {job.status === "completed" ? <p className={lifecycleStyles.noticeSuccess}>{text.completed}</p> : null}

            {cancellable ? (
              <section className={lifecycleStyles.actionPanel}>
                <h2 className="text-[#9f3a2d]">{text.cancelTitle}</h2>
                <p>{text.cancelBody}</p>
                <form action={action} method="post" className={lifecycleStyles.field}>
                  <input type="hidden" name="lang" value={locale} />
                  <input type="hidden" name="intent" value="cancel" />
                  <label>{text.reason}</label>
                  <textarea name="reason" maxLength={1000} rows={3} className={lifecycleStyles.textarea} />
                  <button type="submit" className={lifecycleStyles.dangerAction}>{text.cancel}</button>
                </form>
              </section>
            ) : null}

            {rematchEligible ? (
              <section className={lifecycleStyles.actionPanel}>
                <h2>{text.rematchTitle}</h2>
                <p>{text.rematchBody}</p>
                {rematch ? (
                  <p className={lifecycleStyles.noticeInfo}>{rematchMessage}</p>
                ) : (
                  <form action={action} method="post" className={lifecycleStyles.field}>
                    <input type="hidden" name="lang" value={locale} />
                    <input type="hidden" name="intent" value="rematch" />
                    <label>{text.reason}</label>
                    <textarea name="reason" maxLength={1000} rows={3} className={lifecycleStyles.textarea} />
                    <button type="submit" className={lifecycleStyles.primaryAction}>{text.rematch}</button>
                  </form>
                )}
              </section>
            ) : null}

            <p className={lifecycleStyles.protected}>{text.protected}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
