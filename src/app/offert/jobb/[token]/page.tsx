import type { Metadata } from "next";
import Link from "next/link";

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

  if (!job || !quoteView?.customerContact) {
    return <main lang={locale} className="min-h-screen bg-[#f7f7f4] px-4 py-16"><p className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center">{text.unavailable}</p></main>;
  }

  const contact = quoteView.customerContact;
  const address = [contact.addressLine1, contact.postalCode, contact.city].filter(Boolean).join(", ");
  const alternative = locale === "en" ? "sv" : "en";
  const rawJobAction = query?.job;
  const jobAction = Array.isArray(rawJobAction) ? rawJobAction[0] : rawJobAction;
  const languageParams = new URLSearchParams();
  if (alternative === "en") languageParams.set("lang", "en");
  if (jobAction) languageParams.set("job", jobAction);
  const languageQuery = languageParams.toString();
  const languageHref = `/offert/jobb/${encodeURIComponent(token)}${languageQuery ? `?${languageQuery}` : ""}`;
  const feedback = actionMessage(jobAction, locale);
  const canStart = job.status === "accepted" || job.status === "problem";
  const canComplete = job.status === "in_progress" || job.status === "problem";
  const canReportProblem = job.status === "accepted" || job.status === "in_progress";
  const canCancel = job.status === "accepted" || job.status === "in_progress" || job.status === "problem";
  const canNoShow = job.status === "accepted";
  const action = `/api/marketplace/service-job/${encodeURIComponent(token)}`;

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
          {feedback ? <p role={feedback.severity === "error" ? "alert" : "status"} className={feedback.severity === "error" ? "rounded-xl border border-[#efc2bb] bg-[#fff1ef] px-4 py-3 text-sm font-semibold text-[#8a2b20]" : "rounded-xl border border-[#a9cdb2] bg-[#edf8ef] px-4 py-3 text-sm font-semibold text-[#17452f]"}>{feedback.text}</p> : null}

          <dl className="grid gap-4 rounded-2xl bg-[#f7f9f7] p-5 sm:grid-cols-2">
            <div><dt className="text-xs font-bold uppercase text-[#6b776d]">{text.status}</dt><dd className="mt-1 font-bold">{job.status}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-[#6b776d]">{text.service}</dt><dd className="mt-1 font-semibold">{job.serviceName}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-[#6b776d]">{text.date}</dt><dd className="mt-1 font-semibold">{job.scheduledDate || "—"}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-[#6b776d]">{text.price}</dt><dd className="mt-1 font-semibold">{formatMoney(job.amountMinor, job.currency, locale)}</dd></div>
          </dl>

          <section className="rounded-2xl border border-[#a9cdb2] bg-[#edf8ef] p-5 text-[#17452f]">
            <h2 className="font-bold">{text.customer}</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-bold">{text.name}</dt><dd>{contact.name || "—"}</dd></div>
              <div><dt className="font-bold">{text.email}</dt><dd>{contact.email ? <a className="underline" href={`mailto:${contact.email}`}>{contact.email}</a> : "—"}</dd></div>
              <div><dt className="font-bold">{text.phone}</dt><dd>{contact.phone ? <a className="underline" href={`tel:${contact.phone}`}>{contact.phone}</a> : "—"}</dd></div>
              <div><dt className="font-bold">{text.address}</dt><dd>{address || "—"}</dd></div>
            </dl>
          </section>

          {canStart ? <form action={action} method="post"><input type="hidden" name="lang" value={locale} /><input type="hidden" name="nextStatus" value="in_progress" /><button className="min-h-12 w-full rounded-xl bg-[#17452f] px-5 py-3 font-bold text-white" type="submit">{text.start}</button></form> : null}

          {canComplete ? <form action={action} method="post" className="grid gap-3 rounded-2xl border border-[#dce5da] p-5"><input type="hidden" name="lang" value={locale} /><input type="hidden" name="nextStatus" value="completed" /><label className="grid gap-2 text-sm font-bold">{text.completion}<textarea name="completionSummary" minLength={3} maxLength={4000} required rows={4} className="rounded-xl border p-3 font-normal" /></label><p className="text-xs text-[#6b776d]">{text.completionHint}</p><button className="min-h-12 rounded-xl bg-[#17452f] px-5 py-3 font-bold text-white" type="submit">{text.complete}</button></form> : null}

          {canReportProblem ? <form action={action} method="post" className="grid gap-3 rounded-2xl border p-5"><input type="hidden" name="lang" value={locale} /><input type="hidden" name="nextStatus" value="problem" /><label className="grid gap-2 text-sm font-bold">{text.problemReason}<textarea name="reason" minLength={3} maxLength={1000} required rows={3} className="rounded-xl border p-3 font-normal" /></label><button className="min-h-11 rounded-xl border border-[#8a5b00] px-4 py-2 font-bold text-[#8a5b00]" type="submit">{text.problem}</button></form> : null}

          {canCancel ? <form action={action} method="post" className="grid gap-3 rounded-2xl border border-[#efd0cb] p-5"><input type="hidden" name="lang" value={locale} /><input type="hidden" name="nextStatus" value="provider_cancelled" /><label className="grid gap-2 text-sm font-bold">{text.cancelReason}<textarea name="reason" minLength={3} maxLength={1000} required rows={3} className="rounded-xl border p-3 font-normal" /></label><button className="min-h-11 rounded-xl bg-[#8a2b20] px-4 py-2 font-bold text-white" type="submit">{text.cancel}</button></form> : null}

          {canNoShow ? <form action={action} method="post" className="grid gap-3"><input type="hidden" name="lang" value={locale} /><input type="hidden" name="nextStatus" value="no_show" /><input type="hidden" name="reason" value="Customer no-show" /><button className="min-h-11 rounded-xl border border-[#8a2b20] px-4 py-2 font-bold text-[#8a2b20]" type="submit">{text.noShow}</button></form> : null}

          <section className="rounded-2xl bg-[#f7f9f7] p-5"><p className="text-sm leading-6 text-[#5b665f]">{text.claimBody}</p><Link href={`/foretag/claim/${encodeURIComponent(quoteView.profileSlug)}`} className="mt-3 inline-flex font-bold text-[#17452f] underline">{text.claim}</Link></section>
        </div>
      </section>
    </main>
  );
}
