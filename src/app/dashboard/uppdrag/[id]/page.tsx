import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft, CheckCircle2, ClipboardCheck, FileText, MessageSquarePlus, UserRoundCheck, XCircle } from "lucide-react";

import { DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import {
  addDashboardWorkspaceServiceJobNote,
  assignDashboardWorkspaceServiceJob,
  getDashboardWorkspaceServiceJobDetail,
  transitionDashboardWorkspaceServiceJob,
} from "@/lib/workspace-service-jobs-db";
import { getWorkspaceServiceJobTransitions, isWorkspaceServiceJobStatus } from "@/lib/workspace-service-job-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";

const statusLabel = {
  sv: { new: "Ny", assigned: "Tilldelad", in_progress: "Pågår", completed: "Klar", cancelled: "Avbruten" },
  en: { new: "New", assigned: "Assigned", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" },
} as const;

const copy = {
  sv: {
    back: "Till uppdrag", eyebrow: "Servicejobb", source: "Källa", booking: "Bokning", quote: "Accepterad offert", customer: "Kund", noCustomer: "Ej angivet", staff: "Ansvarig", noStaff: "Ej tilldelad", service: "Tjänst", location: "Ort", schedule: "Tid", status: "Status", total: "Totalt", details: "Uppdragsdetaljer", assignment: "Tilldela medarbetare", assign: "Tilldela", noActiveStaff: "Inga aktiva medarbetare finns att tilldela.", actions: "Arbetsflöde", start: "Starta uppdrag", cancel: "Avbryt uppdrag", complete: "Markera som klart", evidence: "Slutförandebevis", evidenceHint: "Beskriv utfört arbete, resultat eller annan verifierbar information.", notes: "Anteckningar", addNote: "Lägg till anteckning", history: "Händelser", attachments: "Bilagor", noAttachments: "Inga bilagor har lagts till ännu.", evidenceTitle: "Slutförandebevis", error: "Åtgärden kunde inte sparas. Kontrollera behörighet och försök igen.", updated: "Uppdraget uppdaterades.", noted: "Anteckningen lades till.", assigned: "Medarbetaren tilldelades.", sourceBooking: "Bokningsprofil", sourceQuote: "Offertförfrågan",
  },
  en: {
    back: "Back to jobs", eyebrow: "Service job", source: "Source", booking: "Booking", quote: "Accepted quote", customer: "Customer", noCustomer: "Not provided", staff: "Owner", noStaff: "Unassigned", service: "Service", location: "Location", schedule: "Schedule", status: "Status", total: "Total", details: "Job details", assignment: "Assign staff member", assign: "Assign", noActiveStaff: "There are no active staff members to assign.", actions: "Workflow", start: "Start job", cancel: "Cancel job", complete: "Mark as completed", evidence: "Completion evidence", evidenceHint: "Describe the completed work, result, or another verifiable outcome.", notes: "Notes", addNote: "Add note", history: "Events", attachments: "Attachments", noAttachments: "No attachments have been added yet.", evidenceTitle: "Completion evidence", error: "The action could not be saved. Check your permissions and try again.", updated: "The service job was updated.", noted: "The note was added.", assigned: "The staff member was assigned.", sourceBooking: "Booking profile", sourceQuote: "Quote enquiry",
  },
} as const;

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

function href(path: string, locale: Locale, state?: string) {
  const query = new URLSearchParams();
  if (locale === "en") query.set("lang", "en");
  if (state) query.set("state", state);
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function money(amount: number | null, currency: string, locale: Locale) {
  if (amount === null || !currency) return "—";
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount / 100);
}

export default async function ServiceJobDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lang?: string | string[]; state?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const locale: Locale = value(query?.lang) === "en" ? "en" : "sv";
  const text = copy[locale];
  const access = await getUserWorkspaceAccess();
  if (!access.ok) redirect(access.reason === "no_session" ? "/logga-in" : "/dashboard");
  const detail = await getDashboardWorkspaceServiceJobDetail(id);
  if (!detail) notFound();
  const canManage = canManageWorkspaceSettings(access);
  const { job } = detail;
  const transitions = getWorkspaceServiceJobTransitions(job.status);
  const state = value(query?.state);

  async function assign(formData: FormData) {
    "use server";
    try {
      await assignDashboardWorkspaceServiceJob(id, String(formData.get("staffId") ?? ""));
    } catch {
      redirect(href(`/dashboard/uppdrag/${id}`, locale, "error"));
    }
    redirect(href(`/dashboard/uppdrag/${id}`, locale, "assigned"));
  }

  async function transition(formData: FormData) {
    "use server";
    const next = String(formData.get("status") ?? "");
    if (!isWorkspaceServiceJobStatus(next)) redirect(href(`/dashboard/uppdrag/${id}`, locale, "error"));
    try {
      await transitionDashboardWorkspaceServiceJob(id, next, String(formData.get("evidence") ?? ""));
    } catch {
      redirect(href(`/dashboard/uppdrag/${id}`, locale, "error"));
    }
    redirect(href(`/dashboard/uppdrag/${id}`, locale, "updated"));
  }

  async function addNote(formData: FormData) {
    "use server";
    try {
      await addDashboardWorkspaceServiceJobNote(id, String(formData.get("body") ?? ""));
    } catch {
      redirect(href(`/dashboard/uppdrag/${id}`, locale, "error"));
    }
    redirect(href(`/dashboard/uppdrag/${id}`, locale, "noted"));
  }

  const stateMessage = state === "error" ? text.error : state === "assigned" ? text.assigned : state === "noted" ? text.noted : state === "updated" ? text.updated : "";
  const sourceHref = job.sourceType === "booking" ? `/dashboard/bokningar/${job.bookingId}` : `/dashboard/offerter/${job.quoteRequestId}`;
  const sourceLabel = job.sourceType === "booking" ? text.sourceBooking : text.sourceQuote;
  const metrics = [
    { label: text.status, value: statusLabel[locale][job.status], helper: text.source, icon: ClipboardCheck, tone: "bg-[#eef5ff] text-[#1469d8]" },
    { label: text.customer, value: job.customerName || text.noCustomer, helper: job.city || "—", icon: UserRoundCheck, tone: "bg-[#eef5ff] text-[#0a2e63]" },
    { label: text.staff, value: job.assignedStaffName || text.noStaff, helper: job.serviceName || "—", icon: Activity, tone: "bg-[#fff7df] text-[#805d14]" },
    { label: text.total, value: money(job.totalMinor, job.currency, locale), helper: job.currency || "—", icon: CheckCircle2, tone: "bg-[#eaf8f2] text-[#087754]" },
  ];

  return (
    <div className="grid gap-6" lang={locale}>
      <Link href={href("/dashboard/uppdrag", locale)} className="inline-flex w-fit items-center gap-2 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{text.back}</Link>
      <DashboardPageHeader eyebrow={text.eyebrow} title={job.title} description={job.sourceType === "booking" ? text.booking : text.quote} icon={ClipboardCheck} actions={<Link href={href(sourceHref, locale)} className="inline-flex min-h-10 items-center justify-center rounded-control border border-line bg-surface px-4 py-2 text-sm font-bold text-brand">{sourceLabel}</Link>} />
      {stateMessage ? <p className={`rounded-card p-4 text-sm font-semibold ${state === "error" ? "border border-[#f4c7ba] bg-[#fff5f2] text-danger" : "border border-[#cfe8d6] bg-[#eaf8f2] text-[#087754]"}`}>{stateMessage}</p> : null}
      <DashboardMetricGrid items={metrics} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <article className="rounded-card border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold text-ink">{text.details}</h2><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{text.source}</dt><dd className="mt-1 font-semibold">{job.sourceType === "booking" ? text.booking : text.quote}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{text.schedule}</dt><dd className="mt-1">{job.scheduledStartsAt ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.scheduledStartsAt)) : "—"}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{text.location}</dt><dd className="mt-1">{job.city || "—"}</dd></div><div><dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{text.service}</dt><dd className="mt-1">{job.serviceName || "—"}</dd></div></dl>{job.description ? <p className="mt-5 whitespace-pre-wrap rounded-control border border-[#e4e9e2] bg-surface-subtle p-4 text-sm leading-7 text-ink-muted">{job.description}</p> : null}</article>

          {canManage ? <article className="rounded-card border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold text-ink">{text.actions}</h2><div className="mt-5 grid gap-4">{transitions.includes("in_progress") ? <form action={transition}><input type="hidden" name="status" value="in_progress" /><button type="submit" className="inline-flex min-h-11 w-fit rounded-control bg-brand-deep px-5 py-2.5 text-sm font-bold text-white">{text.start}</button></form> : null}{transitions.includes("completed") ? <form action={transition} className="grid gap-3 rounded-control border border-line bg-surface-subtle p-4"><input type="hidden" name="status" value="completed" /><label className="grid gap-2 text-sm font-semibold text-ink"><span>{text.evidence}</span><textarea name="evidence" required maxLength={5000} rows={4} placeholder={text.evidenceHint} className="rounded-control border border-line bg-surface px-3 py-2 text-sm" /></label><button type="submit" className="inline-flex min-h-11 w-fit rounded-control bg-brand-deep px-5 py-2.5 text-sm font-bold text-white">{text.complete}</button></form> : null}{transitions.includes("cancelled") ? <form action={transition}><input type="hidden" name="status" value="cancelled" /><button type="submit" className="inline-flex min-h-11 w-fit rounded-control border border-[#d9a39a] bg-surface px-5 py-2.5 text-sm font-bold text-[#8f2f1b]"><XCircle className="mr-2 h-4 w-4" />{text.cancel}</button></form> : null}</div></article> : null}

          <article className="rounded-card border border-line bg-surface p-5 shadow-sm sm:p-6"><h2 className="text-xl font-bold text-ink">{text.notes}</h2>{canManage ? <form action={addNote} className="mt-4 grid gap-3"><textarea name="body" required maxLength={5000} rows={4} className="rounded-control border border-line bg-surface px-3 py-2 text-sm" /><button type="submit" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-control bg-brand-deep px-5 py-2.5 text-sm font-bold text-white"><MessageSquarePlus className="h-4 w-4" />{text.addNote}</button></form> : null}<div className="mt-5 grid gap-3">{detail.notes.map((note) => <article key={note.id} className="rounded-control bg-surface-subtle p-4 text-sm text-ink-muted"><p className="whitespace-pre-wrap leading-6">{note.body}</p><p className="mt-2 text-xs text-ink-muted">{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.createdAt))}</p></article>)}</div></article>
        </div>

        <aside className="grid gap-6">
          {canManage ? <article className="rounded-card border border-line bg-surface p-5 shadow-sm"><h2 className="text-lg font-bold text-ink">{text.assignment}</h2>{detail.staff.length ? <form action={assign} className="mt-4 grid gap-3"><select name="staffId" defaultValue={job.assignedStaffId} className="min-h-11 rounded-control border border-line bg-surface px-3 text-sm"><option value="" disabled>{text.noStaff}</option>{detail.staff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name}</option>)}</select><button type="submit" className="inline-flex min-h-11 w-fit rounded-control bg-brand-deep px-4 py-2 text-sm font-bold text-white">{text.assign}</button></form> : <p className="mt-3 text-sm leading-6 text-ink-muted">{text.noActiveStaff}</p>}</article> : null}
          <article className="rounded-card border border-line bg-surface p-5 shadow-sm"><h2 className="text-lg font-bold text-ink">{text.evidenceTitle}</h2><div className="mt-4 grid gap-3">{detail.evidence.map((evidence) => <div key={evidence.id} className="rounded-control bg-surface-subtle p-3 text-sm"><p>{evidence.description || evidence.evidenceType}</p><p className="mt-2 text-xs text-ink-muted">{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "medium" }).format(new Date(evidence.createdAt))}</p></div>)}</div></article>
          <article className="rounded-card border border-line bg-surface p-5 shadow-sm"><h2 className="text-lg font-bold text-ink">{text.attachments}</h2>{detail.attachments.length ? <div className="mt-4 grid gap-3">{detail.attachments.map((attachment) => <div key={attachment.id} className="rounded-control bg-surface-subtle p-3 text-sm"><FileText className="mb-2 h-4 w-4 text-brand" /><p className="font-semibold">{attachment.fileName}</p><p className="mt-1 text-xs text-ink-muted">{attachment.contentType || "—"}</p></div>)}</div> : <p className="mt-3 text-sm text-ink-muted">{text.noAttachments}</p>}</article>
          <article className="rounded-card border border-line bg-surface p-5 shadow-card"><h2 className="text-lg font-bold">{text.history}</h2><div className="mt-4 grid gap-3">{detail.events.map((event) => <div key={event.id} className="rounded-control bg-surface/10 p-3 text-sm"><p className="font-semibold">{event.summary}</p><p className="mt-2 text-xs text-ink-muted">{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</p></div>)}</div></article>
        </aside>
      </section>
    </div>
  );
}
