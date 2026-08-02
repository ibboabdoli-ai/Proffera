import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2, CircleDashed, Clock3, UserRound } from "lucide-react";

import { DashboardDataPanel, DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardWorkspaceServiceJobs } from "@/lib/workspace-service-jobs-db";
import type { WorkspaceServiceJobStatus } from "@/lib/workspace-service-job-policy";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";

const statusTone: Record<WorkspaceServiceJobStatus, string> = {
  new: "bg-[#f8f0df] text-[#8a6722]",
  assigned: "bg-[#edf0f8] text-[#405582]",
  in_progress: "bg-[#e9f2ec] text-[#17452f]",
  completed: "bg-[#e4f4e8] text-[#1f6a3d]",
  cancelled: "bg-[#f7e9e7] text-[#8b3f35]",
};

const copy = {
  sv: {
    eyebrow: "Uppdrag",
    title: "Servicejobb",
    description: "Bekräftade bokningar och accepterade offerter samlas här i ett gemensamt arbetsflöde.",
    active: "Aktiva",
    unassigned: "Ej tilldelade",
    progress: "Pågår",
    completed: "Klara",
    all: "Alla servicejobb",
    empty: "Inga servicejobb finns ännu. Ett jobb skapas när en bokning bekräftas eller en offert accepteras.",
    customer: "Kund",
    source: "Källa",
    staff: "Ansvarig",
    status: "Status",
    updated: "Uppdaterad",
    open: "Öppna",
    booking: "Bokning",
    quote: "Accepterad offert",
    noCustomer: "Ej angivet",
    noStaff: "Ej tilldelad",
  },
  en: {
    eyebrow: "Jobs",
    title: "Service jobs",
    description: "Confirmed bookings and accepted quotes are collected in one shared fulfillment workflow.",
    active: "Active",
    unassigned: "Unassigned",
    progress: "In progress",
    completed: "Completed",
    all: "All service jobs",
    empty: "There are no service jobs yet. A job is created when a booking is confirmed or a quote is accepted.",
    customer: "Customer",
    source: "Source",
    staff: "Owner",
    status: "Status",
    updated: "Updated",
    open: "Open",
    booking: "Booking",
    quote: "Accepted quote",
    noCustomer: "Not provided",
    noStaff: "Unassigned",
  },
} as const;

const statusLabel: Record<Locale, Record<WorkspaceServiceJobStatus, string>> = {
  sv: { new: "Ny", assigned: "Tilldelad", in_progress: "Pågår", completed: "Klar", cancelled: "Avbruten" },
  en: { new: "New", assigned: "Assigned", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" },
};

function href(path: string, locale: Locale) {
  return locale === "en" ? `${path}?lang=en` : path;
}

export default async function ServiceJobsPage({ searchParams }: { searchParams?: Promise<{ lang?: string | string[] }> }) {
  const query = searchParams ? await searchParams : undefined;
  const language = Array.isArray(query?.lang) ? query.lang[0] : query?.lang;
  const locale: Locale = language === "en" ? "en" : "sv";
  const text = copy[locale];
  const jobs = await getDashboardWorkspaceServiceJobs();
  const active = jobs.filter((job) => !["completed", "cancelled"].includes(job.status));
  const metrics = [
    { label: text.active, value: String(active.length), helper: text.all, icon: BriefcaseBusiness, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: text.unassigned, value: String(active.filter((job) => !job.assignedStaffId).length), helper: text.active, icon: UserRound, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: text.progress, value: String(jobs.filter((job) => job.status === "in_progress").length), helper: text.active, icon: Clock3, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: text.completed, value: String(jobs.filter((job) => job.status === "completed").length), helper: text.all, icon: CheckCircle2, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ];

  return (
    <div className="grid gap-6" lang={locale}>
      <DashboardPageHeader eyebrow={text.eyebrow} title={text.title} description={text.description} icon={BriefcaseBusiness} />
      <DashboardMetricGrid items={metrics} />
      <DashboardDataPanel title={text.all} description={text.description} count={jobs.length}>
        {jobs.length === 0 ? (
          <div className="p-5 sm:p-6"><div className="rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] px-5 py-8 text-center text-sm text-[#667168]">{text.empty}</div></div>
        ) : (
          <>
            <div className="hidden grid-cols-[1.2fr_1fr_0.9fr_0.8fr_0.8fr_0.9fr_0.6fr] gap-4 border-b border-[#e5e9e2] bg-[#f7f9f6] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#778179] xl:grid"><span>{text.customer}</span><span>{text.source}</span><span>{text.staff}</span><span>{text.status}</span><span>{text.updated}</span><span>{text.title}</span><span /></div>
            {jobs.map((job) => (
              <div key={job.id} className="mx-3 my-3 grid gap-3 rounded-2xl border border-[#e2e7df] bg-white p-4 text-sm text-[#435047] shadow-sm xl:mx-0 xl:my-0 xl:grid-cols-[1.2fr_1fr_0.9fr_0.8fr_0.8fr_0.9fr_0.6fr] xl:items-center xl:gap-4 xl:rounded-none xl:border-x-0 xl:border-t-0 xl:px-6 xl:py-4 xl:shadow-none">
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">{text.customer}</p><p className="font-semibold text-[#17201a]">{job.customerName || text.noCustomer}</p><p className="mt-1 text-xs text-[#667168]">{job.city || "—"}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">{text.source}</p><p>{job.sourceType === "booking" ? text.booking : text.quote}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">{text.staff}</p><p>{job.assignedStaffName || text.noStaff}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">{text.status}</p><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone[job.status]}`}>{statusLabel[locale][job.status]}</span></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">{text.updated}</p><p>{new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "medium" }).format(new Date(job.updatedAt))}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">{text.title}</p><p className="font-semibold text-[#17201a]">{job.title}</p></div>
                <Link href={href(`/dashboard/uppdrag/${job.id}`, locale)} className="inline-flex min-h-9 w-fit items-center justify-center gap-1.5 rounded-lg bg-[#173e2b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0f3020]"><CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />{text.open}</Link>
              </div>
            ))}
          </>
        )}
      </DashboardDataPanel>
    </div>
  );
}
