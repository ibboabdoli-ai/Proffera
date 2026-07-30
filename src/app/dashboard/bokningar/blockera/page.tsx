import Link from "next/link";
import { CalendarOff, Repeat2, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardLocaleBoundary } from "@/components/dashboard/dashboard-locale-boundary";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { AvailabilityBlockValidationError, createDashboardAvailabilityBlock, createDashboardRecurringAvailabilityBlocks } from "@/lib/dashboard-availability-blocks";
import { deleteDashboardAvailabilityBlock, getDashboardAvailabilityBlocks } from "@/lib/dashboard-availability-management";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: Promise<{ error?: string | string[]; created?: string | string[]; count?: string | string[]; deleted?: string | string[]; lang?: string | string[] }> };

const errorsSv: Record<string, string> = { access: "Du saknar behörighet att hantera bokningstider.", time: "Ange giltiga datum och tider.", past: "Minst en vald tid måste ligga framåt i tiden.", range: "Kontrollera datumintervallet och att sluttiden ligger efter starttiden.", weekdays: "Välj minst en veckodag.", conflict: "Minst en vald tid innehåller redan en aktiv bokning eller blockering. Inga tider skapades.", save: "Ändringen kunde inte sparas. Kontrollera uppgifterna och försök igen." };
const errorsEn: Record<string, string> = { access: "You do not have permission to manage booking availability.", time: "Enter valid dates and times.", past: "At least one selected time must be in the future.", range: "Check the date range and ensure the end time is after the start time.", weekdays: "Select at least one weekday.", conflict: "At least one selected time already contains an active booking or block. No times were created.", save: "The change could not be saved. Check the information and try again." };
const weekdaysSv = [{ value: 1, label: "Måndag" }, { value: 2, label: "Tisdag" }, { value: 3, label: "Onsdag" }, { value: 4, label: "Torsdag" }, { value: 5, label: "Fredag" }, { value: 6, label: "Lördag" }, { value: 0, label: "Söndag" }];
const weekdaysEn = [{ value: 1, label: "Monday" }, { value: 2, label: "Tuesday" }, { value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" }, { value: 5, label: "Friday" }, { value: 6, label: "Saturday" }, { value: 0, label: "Sunday" }];

function firstParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function localizedHref(href: string, isEnglish: boolean) { return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href; }
function formLanguage(formData: FormData) { return String(formData.get("lang") ?? "") === "en"; }
function formatDate(value: string, isEnglish: boolean) { return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", { timeZone: "Europe/Stockholm", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
async function requireAvailabilityAccess() { const access = await getUserWorkspaceAccess(); return access.ok && canManageWorkspaceSettings(access) && (await hasDashboardModuleAccess("online_booking")); }

async function createAvailabilityBlockAction(formData: FormData) {
  "use server";
  const isEnglish = formLanguage(formData);
  if (!(await requireAvailabilityAccess())) redirect(localizedHref("/dashboard/bokningar/blockera?error=access", isEnglish));
  try { await createDashboardAvailabilityBlock({ localStartsAt: String(formData.get("starts_at") ?? "").trim(), localEndsAt: String(formData.get("ends_at") ?? "").trim(), reason: String(formData.get("reason") ?? "").trim() }); }
  catch (error) { if (error instanceof AvailabilityBlockValidationError) redirect(localizedHref(`/dashboard/bokningar/blockera?error=${error.code}`, isEnglish)); console.error("Failed to create dashboard availability block", error); redirect(localizedHref("/dashboard/bokningar/blockera?error=save", isEnglish)); }
  redirect(localizedHref("/dashboard/bokningar/blockera?created=single", isEnglish));
}

async function createRecurringAvailabilityBlockAction(formData: FormData) {
  "use server";
  const isEnglish = formLanguage(formData);
  if (!(await requireAvailabilityAccess())) redirect(localizedHref("/dashboard/bokningar/blockera?error=access", isEnglish));
  let count = 0;
  try { const result = await createDashboardRecurringAvailabilityBlocks({ startDate: String(formData.get("recurring_start_date") ?? "").trim(), endDate: String(formData.get("recurring_end_date") ?? "").trim(), startTime: String(formData.get("recurring_start_time") ?? "").trim(), endTime: String(formData.get("recurring_end_time") ?? "").trim(), weekdays: formData.getAll("weekdays").map((value) => Number(value)), reason: String(formData.get("recurring_reason") ?? "").trim() }); count = result.count; }
  catch (error) { if (error instanceof AvailabilityBlockValidationError) redirect(localizedHref(`/dashboard/bokningar/blockera?error=${error.code}`, isEnglish)); console.error("Failed to create recurring dashboard availability blocks", error); redirect(localizedHref("/dashboard/bokningar/blockera?error=save", isEnglish)); }
  redirect(localizedHref(`/dashboard/bokningar/blockera?created=recurring&count=${count}`, isEnglish));
}

async function deleteAvailabilityBlockAction(formData: FormData) {
  "use server";
  const isEnglish = formLanguage(formData);
  if (!(await requireAvailabilityAccess())) redirect(localizedHref("/dashboard/bokningar/blockera?error=access", isEnglish));
  try { await deleteDashboardAvailabilityBlock(String(formData.get("block_id") ?? "").trim()); }
  catch (error) { console.error("Failed to delete dashboard availability block", error); redirect(localizedHref("/dashboard/bokningar/blockera?error=save", isEnglish)); }
  redirect(localizedHref("/dashboard/bokningar/blockera?deleted=1", isEnglish));
}

const inputClass = "rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm text-[#17201a] outline-none focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20";

export default async function AvailabilityBlockPage({ searchParams }: PageProps) {
  const query = searchParams ? await searchParams : undefined;
  const lang = firstParam(query?.lang);
  const isEnglish = lang === "en";
  const blocks = await getDashboardAvailabilityBlocks();
  const errors = isEnglish ? errorsEn : errorsSv;
  const error = errors[firstParam(query?.error) ?? ""];
  const created = firstParam(query?.created);
  const deleted = firstParam(query?.deleted) === "1";
  const count = Math.max(0, Number(firstParam(query?.count)) || 0);
  const weekdays = isEnglish ? weekdaysEn : weekdaysSv;

  return <DashboardLocaleBoundary isEnglish={isEnglish}><div className="grid gap-6">
    <DashboardPageHeader eyebrow={isEnglish ? "Availability" : "Tillgänglighet"} title={isEnglish ? "Block and manage times" : "Blockera och hantera tider"} description={isEnglish ? "Create one-time or recurring blocks and remove future blocks when plans change." : "Skapa enstaka eller återkommande blockeringar och ta bort framtida blockeringar när planeringen ändras."} icon={CalendarOff} actions={<Link href={localizedHref("/dashboard/kalender", isEnglish)} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f] hover:bg-[#f3f6f2]">{isEnglish ? "Back to calendar" : "Till kalendern"}</Link>} />
    {error ? <p role="alert" className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{error}</p> : null}
    {created ? <p role="status" className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">{created === "recurring" ? (isEnglish ? `${count} recurring blocks were created.` : `${count} återkommande blockeringar skapades.`) : (isEnglish ? "The period was blocked." : "Perioden blockerades.")}</p> : null}
    {deleted ? <p role="status" className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">{isEnglish ? "The block was removed and the time can be booked again." : "Blockeringen togs bort och tiden kan bokas igen."}</p> : null}

    <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#17452f]">{isEnglish ? "Active blocks" : "Aktiva blockeringar"}</p><h2 className="mt-1 text-xl font-bold text-[#17201a]">{isEnglish ? "Upcoming closed times" : "Kommande stängda tider"}</h2></div><span className="rounded-full bg-[#eef2ee] px-3 py-1 text-xs font-bold text-[#435047]">{blocks.length} {isEnglish ? "times" : "tider"}</span></div><div className="mt-5 grid gap-3">{blocks.length === 0 ? <p className="rounded-xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] p-5 text-sm text-[#667168]">{isEnglish ? "There are no future blocks." : "Inga framtida blockeringar finns."}</p> : blocks.map((block) => <article key={block.id} className="flex flex-col gap-4 rounded-2xl border border-[#e1e7df] bg-[#f9faf8] p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-[#17201a]">{block.title}</h3>{block.source === "dashboard_availability_recurring_block" ? <span className="rounded-full bg-[#e8f0ea] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#17452f]">{isEnglish ? "Recurring" : "Återkommande"}</span> : null}</div><p className="mt-1 text-sm text-[#536158]">{formatDate(block.startsAt, isEnglish)} – {formatDate(block.endsAt, isEnglish)}</p></div><form action={deleteAvailabilityBlockAction}><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><input type="hidden" name="block_id" value={block.id}/><button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e0b7b7] bg-white px-4 text-sm font-bold text-[#7a1f1f] hover:bg-[#fff5f5]"><Trash2 className="h-4 w-4" aria-hidden="true"/>{isEnglish ? "Delete" : "Ta bort"}</button></form></article>)}</div></section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-[#17201a]">{isEnglish ? "One-time period" : "Enstaka period"}</h2><p className="mt-3 text-sm leading-7 text-[#5b665f]">{isEnglish ? "Block a few hours, a full day or up to 31 days. Times use Stockholm local time." : "Blockera några timmar, en hel dag eller upp till 31 dagar. Tiderna anges i svensk lokal tid."}</p><form action={createAvailabilityBlockAction} className="mt-6 grid gap-5"><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Start date and time" : "Startdatum och tid"}<input type="datetime-local" name="starts_at" required className={inputClass}/></label><label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "End date and time" : "Slutdatum och tid"}<input type="datetime-local" name="ends_at" required className={inputClass}/></label></div><label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Reason" : "Orsak"}<input name="reason" maxLength={180} placeholder={isEnglish ? "For example: Vacation" : "Till exempel: Semester"} className={inputClass}/></label><button type="submit" className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f3322]">{isEnglish ? "Block period" : "Blockera perioden"}</button></form></section>
      <section className="rounded-[24px] border border-[#d7e3d8] bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-[#eef5ef] p-2 text-[#17452f]"><Repeat2 className="h-5 w-5"/></span><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#17452f]">{isEnglish ? "Recurring" : "Återkommande"}</p><h2 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Repeat weekly" : "Upprepa varje vecka"}</h2></div></div><p className="mt-3 text-sm leading-7 text-[#5b665f]">{isEnglish ? "Choose weekdays, times and a date range. Example: lunch Monday–Friday 11:00–12:00." : "Välj dagar, tider och datumintervall. Exempel: lunch måndag–fredag 11:00–12:00."}</p><form action={createRecurringAvailabilityBlockAction} className="mt-6 grid gap-5"><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><fieldset><legend className="text-sm font-semibold text-[#17201a]">{isEnglish ? "Weekdays" : "Veckodagar"}</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{weekdays.map((day) => <label key={day.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#d9e1d7] px-3 py-2 text-sm font-semibold text-[#344139] has-[:checked]:border-[#17452f] has-[:checked]:bg-[#eef5ef]"><input type="checkbox" name="weekdays" value={day.value} className="h-4 w-4 accent-[#17452f]"/>{day.label}</label>)}</div></fieldset><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "From date" : "Från datum"}<input type="date" name="recurring_start_date" required className={inputClass}/></label><label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Through date" : "Till och med datum"}<input type="date" name="recurring_end_date" required className={inputClass}/></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Start time" : "Starttid"}<input type="time" name="recurring_start_time" required className={inputClass}/></label><label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "End time" : "Sluttid"}<input type="time" name="recurring_end_time" required className={inputClass}/></label></div><label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Reason" : "Orsak"}<input name="recurring_reason" maxLength={180} placeholder={isEnglish ? "For example: Lunch" : "Till exempel: Lunch"} className={inputClass}/></label><button type="submit" className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f3322]">{isEnglish ? "Create recurring blocks" : "Skapa återkommande blockeringar"}</button></form></section>
    </div>
  </div></DashboardLocaleBoundary>;
}
