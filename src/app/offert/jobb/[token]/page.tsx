import type { Metadata } from "next";
import Link from "next/link";

import providerStyles from "@/components/provider-lifecycle/provider-lifecycle.module.css";
import { getMarketplaceGuestQuoteView } from "@/lib/marketplace-guest-quote-human-view";
import { getMarketplaceServiceJobForGuestToken } from "@/lib/marketplace-service-jobs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Marketplace-jobb | Proffera",
  robots: { index: false, follow: false },
};

type Locale = "sv" | "en";
type ActionFeedback = { text: string; severity: "success" | "error" } | null;

function localeFrom(value: string | string[] | undefined): Locale {
  return Array.isArray(value) ? (value[0] === "en" ? "en" : "sv") : value === "en" ? "en" : "sv";
}

const copy = {
  sv: {
    language: "English",
    unavailable: "Jobbet är inte tillgängligt.",
    eyebrow: "Valt Marketplace-jobb",
    title: "Hantera det valda jobbet",
    status: "Status",
    service: "Tjänst",
    date: "Planerat datum",
    price: "Överenskommet pris",
    customer: "Kunduppgifter",
    name: "Namn",
    email: "E-post",
    phone: "Telefon",
    address: "Adress",
    start: "Starta jobbet",
    problem: "Markera problem",
    problemReason: "Beskriv problemet",
    cancel: "Avbryt som företag",
    cancelReason: "Ange varför jobbet avbryts",
    noShow: "Kunden dök inte upp",
    complete: "Markera slutfört",
    completion: "Kort sammanfattning av utfört arbete",
    completionHint: "Slutför bara när arbetet faktiskt är utfört. Därefter kan kunden få en verifierad omdömesinbjudan.",
    claim: "Verifiera företagsprofilen",
    claimBody: "Claim/Upgrade påverkar inte rankingen, men låser upp företagets egna arbetsverktyg.",
  },
  en: {
    language: "Svenska",
    unavailable: "This job is not available.",
    eyebrow: "Selected Marketplace job",
    title: "Manage the selected job",
    status: "Status",
    service: "Service",
    date: "Scheduled date",
    price: "Agreed price",
    customer: "Customer details",
    name: "Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    start: "Start job",
    problem: "Report a problem",
    problemReason: "Describe the problem",
    cancel: "Cancel as provider",
    cancelReason: "Explain why the job is cancelled",
    noShow: "Customer no-show",
    complete: "Mark completed",
    completion: "Short summary of completed work",
    completionHint: "Only complete the job after the work is actually done. The customer can then receive a verified review invitation.",
    claim: "Verify the company profile",
    claimBody: "Claim/Upgrade does not buy ranking, but unlocks the company's own operating tools.",
  },
} as const;

function actionMessage(value: string | undefined, locale: Locale): ActionFeedback {
  const sv = locale === "sv";
  if (value === "in_progress") return { text: sv ? "Jobbet har startats." : "The job has been started.", severity: "success" };
  if (value === "completed") return { text: sv ? "Jobbet har markerats som slutfört." : "The job has been marked completed.", severity: "success" };
  if (value === "provider_cancelled") return { text: sv ? "Jobbet har avbrutits av företaget." : "The job has been cancelled by the provider.", severity: "success" };
  if (value === "no_show") return { text: sv ? "Jobbet har markerats som no-show." : "The job has been marked as a no-show.", severity: "success" };
  if (value === "problem") return { text: sv ? "Problemet har registrerats." : "The problem has been recorded.", severity: "success" };
  if (value === "rematch_requested") return { text: sv ? "Kunden har redan begärt en ny matchning. Det här jobbet är nu historik och kan inte ändras." : "The customer has already requested a new matching round. This job is now historical and cannot be changed.", severity: "error" };
  if (value === "rate_limited") return { text: sv ? "För många försök. Vänta en stund och försök igen." : "Too many attempts. Wait a while and try again.", severity: "error" };
  if (value === "completion_required") return { text: sv ? "Lägg till en sammanfattning av det utförda arbetet." : "Add a summary of the completed work.", severity: "error" };
  if (value === "reason_required") return { text: sv ? "Ange en anledning innan du fortsätter." : "Enter a reason before continuing.", severity: "error" };
  if (value === "invalid" || value === "transition") return { text: sv ? "Åtgärden kan inte göras i jobbets nuvarande status." : "That action is not available in the job's current status.", severity: "error" };
  if (value === "database" || value === "unavailable") return { text: sv ? "Åtgärden kunde inte sparas just nu. Försök igen." : "The action could not be saved right now. Try again.", severity: "error" };
  return null;
}

function formatMoney(amountMinor: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency",
    currency: currency || "SEK",
    maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

export default async function MarketplaceProviderJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[]; job?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = localeFrom(query?.lang);
  const text = copy[locale];
  const [job, quoteView] = await Promise.all([
    getMarketplaceServiceJobForGuestToken(token),
    getMarketplaceGuestQuoteView(token),
  ]);

  const rawJobAction = query?.job;
  const jobAction = Array.isArray(rawJobAction) ? rawJobAction[0] : rawJobAction;
  const hrefFor = (nextLocale: Locale) => {
    const search = new URLSearchParams();
    if (nextLocale === "en") search.set("lang", "en");
    if (jobAction) search.set("job", jobAction);
    const suffix = search.toString();
    return `/offert/jobb/${encodeURIComponent(token)}${suffix ? `?${suffix}` : ""}`;
  };
  const languageNav = (
    <nav className={providerStyles.languageNav} aria-label={locale === "en" ? "Language" : "Språk"}>
      <Link href={hrefFor("sv")} className={locale === "sv" ? providerStyles.languageActive : providerStyles.languageLink}>SV</Link>
      <Link href={hrefFor("en")} className={locale === "en" ? providerStyles.languageActive : providerStyles.languageLink}>EN</Link>
    </nav>
  );

  if (!job || !quoteView?.customerContact) {
    return (
      <main lang={locale} className={providerStyles.page}>
        <section className={providerStyles.unavailable}>
          {languageNav}
          <h1>{text.unavailable}</h1>
        </section>
      </main>
    );
  }

  const contact = quoteView.customerContact;
  const address = [contact.addressLine1, contact.postalCode, contact.city].filter(Boolean).join(", ");
  const feedback = actionMessage(jobAction, locale);
  const canStart = job.status === "accepted" || job.status === "problem";
  const canComplete = job.status === "in_progress" || job.status === "problem";
  const canReportProblem = job.status === "accepted" || job.status === "in_progress";
  const canCancel = job.status === "accepted" || job.status === "in_progress" || job.status === "problem";
  const canNoShow = job.status === "accepted";
  const action = `/api/marketplace/service-job/${encodeURIComponent(token)}`;

  return (
    <main lang={locale} className={providerStyles.page}>
      <div className={providerStyles.shell}>
        <div className={providerStyles.topbar}>
          <div>
            <p className={providerStyles.eyebrow}>{text.eyebrow}</p>
            <h1 className={providerStyles.title}>{text.title}</h1>
          </div>
          {languageNav}
        </div>

        {feedback ? (
          <p role={feedback.severity === "error" ? "alert" : "status"} className={feedback.severity === "error" ? providerStyles.noticeError : providerStyles.noticeSuccess}>
            {feedback.text}
          </p>
        ) : null}

        <section className={providerStyles.panel}>
          <div className={providerStyles.panelBody}>
            <dl className={providerStyles.jobInfo}>
              <div><dt>{text.status}</dt><dd>{job.status}</dd></div>
              <div><dt>{text.service}</dt><dd>{job.serviceName}</dd></div>
              <div><dt>{text.date}</dt><dd>{job.scheduledDate || "—"}</dd></div>
              <div><dt>{text.price}</dt><dd>{formatMoney(job.amountMinor, job.currency, locale)}</dd></div>
            </dl>

            <section className={providerStyles.noticeSuccess}>
              <strong>{text.customer}</strong>
              <div className={providerStyles.contactGrid}>
                <div className={providerStyles.contactCell}><small>{text.name}</small><p>{contact.name || "—"}</p></div>
                <div className={providerStyles.contactCell}><small>{text.email}</small><p>{contact.email ? <a className="underline" href={`mailto:${contact.email}`}>{contact.email}</a> : "—"}</p></div>
                <div className={providerStyles.contactCell}><small>{text.phone}</small><p>{contact.phone ? <a className="underline" href={`tel:${contact.phone}`}>{contact.phone}</a> : "—"}</p></div>
                <div className={providerStyles.contactCell}><small>{text.address}</small><p>{address || "—"}</p></div>
              </div>
            </section>

            {canStart ? (
              <form action={action} method="post" className={providerStyles.actionBlock}>
                <input type="hidden" name="lang" value={locale} />
                <input type="hidden" name="nextStatus" value="in_progress" />
                <button className={providerStyles.primary} type="submit">{text.start}</button>
              </form>
            ) : null}

            {canComplete ? (
              <form action={action} method="post" className={providerStyles.actionBlock}>
                <input type="hidden" name="lang" value={locale} />
                <input type="hidden" name="nextStatus" value="completed" />
                <div className={providerStyles.field}>
                  <label>{text.completion}</label>
                  <textarea name="completionSummary" minLength={3} maxLength={4000} required rows={4} className={providerStyles.textarea} />
                  <span className={providerStyles.helper}>{text.completionHint}</span>
                </div>
                <button className={providerStyles.primary} type="submit">{text.complete}</button>
              </form>
            ) : null}

            {canReportProblem ? (
              <form action={action} method="post" className={providerStyles.actionBlock}>
                <input type="hidden" name="lang" value={locale} />
                <input type="hidden" name="nextStatus" value="problem" />
                <div className={providerStyles.field}>
                  <label>{text.problemReason}</label>
                  <textarea name="reason" minLength={3} maxLength={1000} required rows={3} className={providerStyles.textarea} />
                </div>
                <button className={providerStyles.secondary} type="submit">{text.problem}</button>
              </form>
            ) : null}

            {canCancel ? (
              <form action={action} method="post" className={providerStyles.actionBlock}>
                <input type="hidden" name="lang" value={locale} />
                <input type="hidden" name="nextStatus" value="provider_cancelled" />
                <div className={providerStyles.field}>
                  <label>{text.cancelReason}</label>
                  <textarea name="reason" minLength={3} maxLength={1000} required rows={3} className={providerStyles.textarea} />
                </div>
                <button className={providerStyles.danger} type="submit">{text.cancel}</button>
              </form>
            ) : null}

            {canNoShow ? (
              <form action={action} method="post" className={providerStyles.actionBlock}>
                <input type="hidden" name="lang" value={locale} />
                <input type="hidden" name="nextStatus" value="no_show" />
                <input type="hidden" name="reason" value="Customer no-show" />
                <button className={providerStyles.danger} type="submit">{text.noShow}</button>
              </form>
            ) : null}

            <section className={providerStyles.noticeInfo}>
              <p>{text.claimBody}</p>
              <Link href={`/foretag/claim/${encodeURIComponent(quoteView.profileSlug)}`} className="mt-2 inline-flex font-bold underline">{text.claim}</Link>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
