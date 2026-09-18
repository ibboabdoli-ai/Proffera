import type { Metadata } from "next";
import Link from "next/link";

import styles from "@/app/remaining-public-experience.module.css";
import { getMarketplaceGuestQuoteView } from "@/lib/marketplace-guest-quote-human-view";
import { getMarketplaceServiceJobForGuestToken } from "@/lib/marketplace-service-jobs";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";
type ActionFeedback = { text: string; severity: "success" | "error" } | null;

function localeFrom(value: string | string[] | undefined): Locale {
  return Array.isArray(value) ? (value[0] === "en" ? "en" : "sv") : value === "en" ? "en" : "sv";
}

export async function generateMetadata({ searchParams }: { searchParams?: Promise<{ lang?: string | string[] }> }): Promise<Metadata> {
  const query = await (searchParams ?? Promise.resolve(undefined));
  const locale = localeFrom(query?.lang);
  return { title: locale === "en" ? "Marketplace job | Proffera" : "Marketplace-jobb | Proffera", robots: { index: false, follow: false } };
}

const copy = {
  sv: {
    language: "English", unavailable: "Jobbet är inte tillgängligt.", unavailableBody: "Den säkra jobblänken är ogiltig eller jobbet kan inte längre visas.",
    eyebrow: "Valt Marketplace-jobb", title: "Hantera det valda jobbet", status: "Status", service: "Tjänst", date: "Planerat datum", price: "Överenskommet pris",
    customer: "Kunduppgifter", name: "Namn", email: "E-post", phone: "Telefon", address: "Adress",
    start: "Starta jobbet", problem: "Markera problem", problemReason: "Beskriv problemet", cancel: "Avbryt som företag", cancelReason: "Ange varför jobbet avbryts",
    noShow: "Kunden dök inte upp", complete: "Markera slutfört", completion: "Kort sammanfattning av utfört arbete",
    completionHint: "Slutför bara när arbetet faktiskt är utfört. Därefter kan kunden få en verifierad omdömesinbjudan.",
    claim: "Verifiera företagsprofilen", claimBody: "Claim/Upgrade påverkar inte rankingen, men låser upp företagets egna arbetsverktyg.",
  },
  en: {
    language: "Svenska", unavailable: "This job is not available.", unavailableBody: "The secure job link is invalid or the job can no longer be displayed.",
    eyebrow: "Selected Marketplace job", title: "Manage the selected job", status: "Status", service: "Service", date: "Scheduled date", price: "Agreed price",
    customer: "Customer details", name: "Name", email: "Email", phone: "Phone", address: "Address",
    start: "Start job", problem: "Report a problem", problemReason: "Describe the problem", cancel: "Cancel as provider", cancelReason: "Explain why the job is cancelled",
    noShow: "Customer no-show", complete: "Mark completed", completion: "Short summary of completed work",
    completionHint: "Only complete the job after the work is actually done. The customer can then receive a verified review invitation.",
    claim: "Verify the company profile", claimBody: "Claim/Upgrade does not buy ranking, but unlocks the company's own operating tools.",
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

function statusLabel(status: string, locale: Locale) {
  const labels: Record<Locale, Record<string, string>> = {
    sv: { accepted: "Accepterat", in_progress: "Pågår", completed: "Slutfört", provider_cancelled: "Avbrutet av företaget", customer_cancelled: "Avbrutet av kunden", no_show: "Kunden uteblev", problem: "Problem rapporterat" },
    en: { accepted: "Accepted", in_progress: "In progress", completed: "Completed", provider_cancelled: "Cancelled by provider", customer_cancelled: "Cancelled by customer", no_show: "Customer no-show", problem: "Problem reported" },
  };
  return labels[locale][status] ?? (locale === "en" ? "Unknown status" : "Okänd status");
}

function formatMoney(amountMinor: number, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", { style: "currency", currency: currency || "SEK", maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2 }).format(amountMinor / 100);
}

export default async function MarketplaceProviderJobPage({
  params, searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[]; job?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale = localeFrom(query?.lang);
  const text = copy[locale];
  const [job, quoteView] = await Promise.all([getMarketplaceServiceJobForGuestToken(token), getMarketplaceGuestQuoteView(token)]);
  const alternative = locale === "en" ? "sv" : "en";
  const rawJobAction = query?.job;
  const jobAction = Array.isArray(rawJobAction) ? rawJobAction[0] : rawJobAction;
  const languageParams = new URLSearchParams();
  if (alternative === "en") languageParams.set("lang", "en");
  if (jobAction) languageParams.set("job", jobAction);
  const languageQuery = languageParams.toString();
  const languageHref = `/offert/jobb/${encodeURIComponent(token)}${languageQuery ? `?${languageQuery}` : ""}`;

  if (!job || !quoteView?.customerContact) {
    return (
      <main lang={locale} className={styles.page}>
        <section className={[styles.shell, styles.narrow].join(" ")}>
          <header className={styles.header}>
            <div className={styles.headerRow}><div className={styles.headerCopy}><p className={styles.eyebrow}>{text.eyebrow}</p><h1 className={styles.title}>{text.unavailable}</h1></div><Link href={languageHref} className={styles.languageLink}>{text.language}</Link></div>
          </header>
          <div className={styles.stateBody}><p className={styles.sectionCopy}>{text.unavailableBody}</p></div>
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
    <main lang={locale} className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.headerRow}><div className={styles.headerCopy}><p className={styles.eyebrow}>{text.eyebrow}</p><h1 className={styles.title}>{text.title}</h1></div><Link href={languageHref} className={styles.languageLink}>{text.language}</Link></div>
        </header>
        <div className={styles.content}>
          {feedback ? <p role={feedback.severity === "error" ? "alert" : "status"} className={[styles.notice, feedback.severity === "error" ? styles.error : styles.success].join(" ")}>{feedback.text}</p> : null}
          <dl className={styles.facts}>
            <div className={styles.fact}><dt className={styles.label}>{text.status}</dt><dd className={styles.value}>{statusLabel(job.status, locale)}</dd></div>
            <div className={styles.fact}><dt className={styles.label}>{text.service}</dt><dd className={styles.value}>{job.serviceName}</dd></div>
            <div className={styles.fact}><dt className={styles.label}>{text.date}</dt><dd className={styles.value}>{job.scheduledDate || "—"}</dd></div>
          </dl>
          <dl className={styles.facts}><div className={styles.fact}><dt className={styles.label}>{text.price}</dt><dd className={styles.value}>{formatMoney(job.amountMinor, job.currency, locale)}</dd></div></dl>
          <section className={[styles.panel, styles.panelBlue].join(" ")}>
            <h2 className={styles.sectionTitle}>{text.customer}</h2>
            <dl className={styles.facts} style={{ marginTop: "1rem" }}>
              <div className={styles.fact}><dt className={styles.label}>{text.name}</dt><dd className={styles.value}>{contact.name || "—"}</dd></div>
              <div className={styles.fact}><dt className={styles.label}>{text.email}</dt><dd className={styles.value}>{contact.email ? <a className={styles.link} href={`mailto:${contact.email}`}>{contact.email}</a> : "—"}</dd></div>
              <div className={styles.fact}><dt className={styles.label}>{text.phone}</dt><dd className={styles.value}>{contact.phone ? <a className={styles.link} href={`tel:${contact.phone}`}>{contact.phone}</a> : "—"}</dd></div>
            </dl>
            <p className={styles.sectionCopy}><strong>{text.address}: </strong>{address || "—"}</p>
          </section>

          {canStart ? <form action={action} method="post"><input type="hidden" name="lang" value={locale} /><input type="hidden" name="nextStatus" value="in_progress" /><button className={[styles.primaryButton, styles.fullButton].join(" ")} type="submit">{text.start}</button></form> : null}
          {canComplete ? <form action={action} method="post" className={[styles.form, styles.panel].join(" ")}><input type="hidden" name="lang" value={locale} /><input type="hidden" name="nextStatus" value="completed" /><label className={styles.field}>{text.completion}<textarea name="completionSummary" minLength={3} maxLength={4000} required rows={4} className={styles.textarea} /></label><p className={styles.help}>{text.completionHint}</p><button className={styles.primaryButton} type="submit">{text.complete}</button></form> : null}
          {canReportProblem ? <form action={action} method="post" className={[styles.form, styles.panel, styles.panelBlue].join(" ")}><input type="hidden" name="lang" value={locale} /><input type="hidden" name="nextStatus" value="problem" /><label className={styles.field}>{text.problemReason}<textarea name="reason" minLength={3} maxLength={1000} required rows={3} className={styles.textarea} /></label><button className={styles.secondaryButton} type="submit">{text.problem}</button></form> : null}
          {canCancel ? <form action={action} method="post" className={[styles.form, styles.panel, styles.panelDanger].join(" ")}><input type="hidden" name="lang" value={locale} /><input type="hidden" name="nextStatus" value="provider_cancelled" /><label className={styles.field}>{text.cancelReason}<textarea name="reason" minLength={3} maxLength={1000} required rows={3} className={styles.textarea} /></label><button className={styles.dangerButton} type="submit">{text.cancel}</button></form> : null}
          {canNoShow ? <form action={action} method="post"><input type="hidden" name="lang" value={locale} /><input type="hidden" name="nextStatus" value="no_show" /><input type="hidden" name="reason" value="Customer no-show" /><button className={styles.dangerButton} type="submit">{text.noShow}</button></form> : null}
          <section className={styles.panel}><p className={styles.sectionCopy}>{text.claimBody}</p><Link href={`/foretag/claim/${encodeURIComponent(quoteView.profileSlug)}${locale === "en" ? "?lang=en" : ""}`} className={styles.link}>{text.claim}</Link></section>
        </div>
      </section>
    </main>
  );
}
