import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Trash2 } from "lucide-react";

import { DashboardLocaleBoundary } from "@/components/dashboard/dashboard-locale-boundary";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardStaff } from "@/lib/dashboard-staff";
import { createStaffSchedule, createStaffTimeOff, deleteStaffPlanningEntry, getStaffPlanning } from "@/lib/dashboard-staff-schedule";

export const dynamic = "force-dynamic";

const weekdaysSv = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
const weekdaysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const kindLabelsSv: Record<string, string> = { leave: "Ledighet", sick: "Sjuk", break: "Paus", other: "Annat" };
const kindLabelsEn: Record<string, string> = { leave: "Leave", sick: "Sick leave", break: "Break", other: "Other" };

function localizedHref(href: string, isEnglish: boolean) { return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href; }
function formLanguage(formData: FormData) { return String(formData.get("lang") ?? "") === "en"; }

async function createScheduleAction(formData: FormData) {
  "use server";
  const isEnglish = formLanguage(formData);
  try { await createStaffSchedule({ staffId: String(formData.get("staff_id") ?? ""), weekday: Number(formData.get("weekday")), startTime: String(formData.get("start_time") ?? ""), endTime: String(formData.get("end_time") ?? "") }); }
  catch (error) { console.error(error); redirect(localizedHref("/dashboard/personal/tider?error=save", isEnglish)); }
  redirect(localizedHref("/dashboard/personal/tider?updated=1", isEnglish));
}

async function createTimeOffAction(formData: FormData) {
  "use server";
  const isEnglish = formLanguage(formData);
  try { await createStaffTimeOff({ staffId: String(formData.get("staff_id") ?? ""), kind: String(formData.get("kind") ?? "leave"), reason: String(formData.get("reason") ?? ""), startsAt: String(formData.get("starts_at") ?? ""), endsAt: String(formData.get("ends_at") ?? "") }); }
  catch (error) { console.error(error); redirect(localizedHref("/dashboard/personal/tider?error=save", isEnglish)); }
  redirect(localizedHref("/dashboard/personal/tider?updated=1", isEnglish));
}

async function deleteEntryAction(formData: FormData) {
  "use server";
  const isEnglish = formLanguage(formData);
  try { await deleteStaffPlanningEntry(String(formData.get("type")) === "schedule" ? "schedule" : "time_off", String(formData.get("id") ?? "")); }
  catch (error) { console.error(error); redirect(localizedHref("/dashboard/personal/tider?error=save", isEnglish)); }
  redirect(localizedHref("/dashboard/personal/tider?updated=1", isEnglish));
}

function formatDate(value: string, isEnglish: boolean) { return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default async function StaffPlanningPage({ searchParams }: { searchParams?: Promise<{ updated?: string; error?: string; lang?: string | string[] }> }) {
  const [staff, planning, query] = await Promise.all([getDashboardStaff(), getStaffPlanning(), searchParams ?? Promise.resolve(undefined)]);
  const lang = Array.isArray(query?.lang) ? query.lang[0] : query?.lang;
  const isEnglish = lang === "en";
  const weekdays = isEnglish ? weekdaysEn : weekdaysSv;
  const kindLabels = isEnglish ? kindLabelsEn : kindLabelsSv;
  const activeStaff = staff.filter((member) => member.isActive);
  return <DashboardLocaleBoundary isEnglish={isEnglish}><div className="grid gap-6">
    <DashboardPageHeader eyebrow={isEnglish ? "Staff" : "Personal"} title={isEnglish ? "Working hours and time off" : "Arbetstider och ledighet"} description={isEnglish ? "Manage regular shifts, lunch, vacation, sick leave and other time off for each staff member." : "Hantera ordinarie arbetspass, lunch, semester, sjukfrånvaro och annan frånvaro per medarbetare."} icon={CalendarClock} actions={<Link href={localizedHref("/dashboard/personal", isEnglish)} className="inline-flex min-h-11 items-center rounded-xl border border-[#d5ddd3] bg-white px-4 text-sm font-bold text-[#17452f]">{isEnglish ? "Back to staff" : "Till personal"}</Link>} />
    {query?.updated === "1" ? <p className="rounded-2xl bg-[#eef8f1] p-4 text-sm font-semibold text-[#17452f]">{isEnglish ? "The schedule was updated." : "Planeringen uppdaterades."}</p> : null}
    {query?.error ? <p className="rounded-2xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b]">{isEnglish ? "The change could not be saved. Check the selected times and database migration." : "Ändringen kunde inte sparas. Kontrollera migration och tider."}</p> : null}
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{isEnglish ? "Regular working hours" : "Ordinarie arbetstid"}</h2><form action={createScheduleAction} className="mt-5 grid gap-4"><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><select name="staff_id" required className="rounded-xl border px-4 py-3"><option value="">{isEnglish ? "Select staff" : "Välj personal"}</option>{activeStaff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select><select name="weekday" className="rounded-xl border px-4 py-3">{weekdays.map((label, i) => <option key={label} value={i}>{label}</option>)}</select><div className="grid grid-cols-2 gap-3"><input name="start_time" type="time" required className="rounded-xl border px-4 py-3"/><input name="end_time" type="time" required className="rounded-xl border px-4 py-3"/></div><button className="w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-bold text-white">{isEnglish ? "Add working hours" : "Lägg till arbetstid"}</button></form></section>
      <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{isEnglish ? "Time off or break" : "Ledighet eller paus"}</h2><form action={createTimeOffAction} className="mt-5 grid gap-4"><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><select name="staff_id" required className="rounded-xl border px-4 py-3"><option value="">{isEnglish ? "Select staff" : "Välj personal"}</option>{activeStaff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select><select name="kind" className="rounded-xl border px-4 py-3">{Object.entries(kindLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><div className="grid grid-cols-2 gap-3"><input name="starts_at" type="datetime-local" required className="rounded-xl border px-4 py-3"/><input name="ends_at" type="datetime-local" required className="rounded-xl border px-4 py-3"/></div><input name="reason" maxLength={180} placeholder={isEnglish ? "Reason" : "Orsak"} className="rounded-xl border px-4 py-3"/><button className="w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-bold text-white">{isEnglish ? "Add time off" : "Lägg till frånvaro"}</button></form></section>
    </div>
    <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{isEnglish ? "Current schedule" : "Aktuell planering"}</h2><div className="mt-5 grid gap-3">{planning.schedules.map((r) => <article key={r.id} className="flex items-center justify-between rounded-2xl border p-4"><div><strong>{r.staffName}</strong><p className="text-sm text-[#5b665f]">{weekdays[r.weekday]} {r.startTime}–{r.endTime}</p></div><form action={deleteEntryAction}><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><input type="hidden" name="type" value="schedule"/><input type="hidden" name="id" value={r.id}/><button aria-label={isEnglish ? "Delete working hours" : "Ta bort arbetstid"} className="rounded-xl border p-2 text-[#7a1f1f]"><Trash2 className="h-4 w-4"/></button></form></article>)}{planning.timeOff.map((r) => <article key={r.id} className="flex items-center justify-between rounded-2xl border p-4"><div><strong>{r.staffName} · {kindLabels[r.kind] ?? r.kind}</strong><p className="text-sm text-[#5b665f]">{formatDate(r.startsAt, isEnglish)} – {formatDate(r.endsAt, isEnglish)}{r.reason ? ` · ${r.reason}` : ""}</p></div><form action={deleteEntryAction}><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><input type="hidden" name="type" value="time_off"/><input type="hidden" name="id" value={r.id}/><button aria-label={isEnglish ? "Delete time off" : "Ta bort frånvaro"} className="rounded-xl border p-2 text-[#7a1f1f]"><Trash2 className="h-4 w-4"/></button></form></article>)}</div></section>
  </div></DashboardLocaleBoundary>;
}
