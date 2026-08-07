import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft, CalendarCheck2, MessageSquareText, UserRound } from "lucide-react";

import { DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardCustomerDetail } from "@/lib/dashboard-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

export const dynamic = "force-dynamic";

const connectionString = resolveDatabaseUrl()_NON_POOLING;
type Locale = "sv" | "en";
type ErrorKey = "access" | "disabled" | "title" | "note" | "save";
type CustomerDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string | string[]; note?: string | string[]; created?: string | string[]; lang?: string | string[] }>;
};

const customerStatusLabels = {
  sv: { prospect: "Prospekt", active: "Aktiv", paused: "Pausad", lost: "Förlorad" },
  en: { prospect: "Prospect", active: "Active", paused: "Paused", lost: "Lost" },
};
const bookingStatusLabels = {
  sv: { draft: "Utkast", requested: "Förfrågad", confirmed: "Bekräftad", completed: "Klar", cancelled: "Avbokad", no_show: "Uteblev" },
  en: { draft: "Draft", requested: "Requested", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" },
};
const eventTypeLabels = {
  sv: { note: "Notering", call: "Samtal", email: "E-post", booking: "Bokning", status_change: "Statusändring", ai_conversation: "AI-dialog" },
  en: { note: "Note", call: "Call", email: "Email", booking: "Booking", status_change: "Status change", ai_conversation: "AI conversation" },
};
const errorMessages: Record<Locale, Record<ErrorKey, string>> = {
  sv: {
    access: "Du saknar behörighet att lägga till noteringar.", disabled: "Noteringar är inte tillgängliga just nu.", title: "Rubriken saknas eller är för lång.", note: "Noteringen saknas eller är för lång.", save: "Noteringen kunde inte sparas. Försök igen eller kontrollera konfigurationen.",
  },
  en: {
    access: "You do not have permission to add notes.", disabled: "Notes are not available right now.", title: "The title is missing or too long.", note: "The note is missing or too long.", save: "The note could not be saved. Try again or check the configuration.",
  },
};

function getFormText(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function withLang(href: string, locale: Locale) { return locale === "en" ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href; }
function normalizeBookingDisplayText(value: string) { return value.trim().toLocaleLowerCase("sv-SE"); }
function getBookingMetaText(booking: { title: string; service: string; city: string }) {
  return normalizeBookingDisplayText(booking.title) === normalizeBookingDisplayText(booking.service) ? booking.city : `${booking.city} · ${booking.service}`;
}
async function getActiveWorkspaceId() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) throw new Error("An owner or admin workspace membership is required for customer notes");
  return access.workspaceId;
}
function redirectWithNoteError(customerId: string, error: ErrorKey, locale: Locale): never { redirect(withLang(`/dashboard/kunder/${customerId}?error=${error}`, locale)); }

async function createCustomerNoteAction(customerId: string, formData: FormData) {
  "use server";
  const locale: Locale = getFormText(formData, "lang") === "en" ? "en" : "sv";
  const workspaceAccess = await getUserWorkspaceAccess();
  if (!workspaceAccess.ok || !canManageWorkspaceSettings(workspaceAccess) || !(await hasDashboardModuleAccess("customer_crm"))) redirectWithNoteError(customerId, "access", locale);

  const title = getFormText(formData, "title");
  const note = getFormText(formData, "note");
  if (!title || title.length > 140) redirectWithNoteError(customerId, "title", locale);
  if (!note || note.length > 1000) redirectWithNoteError(customerId, "note", locale);
  if (!connectionString) redirectWithNoteError(customerId, "disabled", locale);

  const sql = neon(connectionString);
  const workspaceId = await getActiveWorkspaceId();
  try {
    const rows = await sql`
      insert into customer_events (workspace_id, customer_id, booking_id, event_type, title, description, metadata)
      select workspace_id, id, null, 'note', ${title}, ${note}, jsonb_build_object('source', 'dashboard_manual')
      from customers
      where workspace_id = ${workspaceId} and id = ${customerId}
      returning id
    `;
    if (!rows[0]?.id) redirectWithNoteError(customerId, "save", locale);
  } catch (error) {
    console.error("Failed to create dashboard customer note", error);
    redirectWithNoteError(customerId, "save", locale);
  }
  redirect(withLang(`/dashboard/kunder/${customerId}?note=created`, locale));
}

export default async function CustomerDetailPage({ params, searchParams }: CustomerDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const detail = await getDashboardCustomerDetail(id);
  if (!detail) notFound();

  const { customer, bookings, events } = detail;
  const value = (key: "error" | "note" | "created" | "lang") => { const item = query?.[key]; return Array.isArray(item) ? item[0] : item; };
  const locale: Locale = value("lang") === "en" ? "en" : "sv";
  const isEnglish = locale === "en";
  const errorValue = value("error") as ErrorKey | undefined;
  const errorMessage = errorValue ? errorMessages[locale][errorValue] : undefined;
  const noteAction = createCustomerNoteAction.bind(null, customer.id);
  const customerStatuses = customerStatusLabels[locale];
  const bookingStatuses = bookingStatusLabels[locale];
  const eventTypes = eventTypeLabels[locale];
  const metrics = isEnglish ? [
    { label: "Status", value: customerStatuses[customer.status as keyof typeof customerStatuses] ?? customer.status, helper: "Current CRM status", icon: UserRound, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: "Bookings", value: String(bookings.length), helper: "Connected bookings", icon: CalendarCheck2, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Events", value: String(events.length), helper: "Recorded activities", icon: Activity, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Notes", value: "Internal", helper: "Controlled customer notes", icon: MessageSquareText, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ] as const : [
    { label: "Status", value: customerStatuses[customer.status as keyof typeof customerStatuses] ?? customer.status, helper: "Aktuell CRM-status", icon: UserRound, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: "Bokningar", value: String(bookings.length), helper: "Kopplade bokningar", icon: CalendarCheck2, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Händelser", value: String(events.length), helper: "Registrerade aktiviteter", icon: Activity, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Noteringar", value: "Intern", helper: "Kontrollerad kundnotering", icon: MessageSquareText, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ] as const;
  const fieldClass = "rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20";

  return <div className="grid gap-6">
    <DashboardPageHeader eyebrow={isEnglish ? "Customer profile" : "Kundprofil"} title={customer.name} description={isEnglish ? "View the customer profile, bookings and history. Internal notes can be saved securely." : "Se kundens profil, bokningar och historik. Interna noteringar kan sparas kontrollerat med åtkomstkod."} icon={UserRound} actions={<Link href={withLang("/dashboard/kunder", locale)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f]"><ArrowLeft className="h-4 w-4" />{isEnglish ? "Back to customers" : "Tillbaka till kunder"}</Link>} />
    {errorMessage ? <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{errorMessage}</section> : null}
    {value("created") === "1" ? <section className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">{isEnglish ? "The customer was created and the profile is ready for the next step." : "Kunden skapades och profilen är redo för nästa steg."}</section> : null}
    {value("note") === "created" ? <section className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">{isEnglish ? "The note was saved in the customer history. No booking was changed and no email was sent." : "Noteringen sparades i kundhistoriken. Ingen bokning ändrades och ingen e-post skickades."}</section> : null}
    <DashboardMetricGrid items={metrics} />

    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Profile" : "Profil"}</h3>
          <div className="mt-5 grid gap-3 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139] sm:grid-cols-2">
            <p><strong>{isEnglish ? "Customer type:" : "Kundtyp:"}</strong> {customer.type}</p><p><strong>{isEnglish ? "Location:" : "Ort:"}</strong> {customer.city}</p><p><strong>{isEnglish ? "Email:" : "E-post:"}</strong> {customer.email}</p><p><strong>{isEnglish ? "Phone:" : "Telefon:"}</strong> {customer.phone}</p><p><strong>{isEnglish ? "Company:" : "Företag:"}</strong> {customer.companyName}</p><p><strong>{isEnglish ? "Service:" : "Tjänst:"}</strong> {customer.service}</p><p><strong>{isEnglish ? "Created:" : "Skapad:"}</strong> {customer.createdAt}</p>
          </div>
          <p className="mt-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-7 text-[#344139]"><strong>{isEnglish ? "Notes:" : "Notering:"}</strong> {customer.notes}</p>
        </article>

        <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Add note" : "Lägg till notering"}</h3>
          <p className="mt-3 text-sm leading-7 text-[#5b665f]">{isEnglish ? "Save an internal note in the customer history. No booking is changed and no email is sent." : "Sparar en intern notering i kundhistoriken. Ingen bokning ändras och ingen e-post skickas."}</p>
          <form action={noteAction} className="mt-5 grid gap-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4">
            <input type="hidden" name="lang" value={locale} />
            <label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Title" : "Rubrik"}<input name="title" type="text" required maxLength={140} className={fieldClass} placeholder={isEnglish ? "For example: Follow-up" : "Till exempel: Uppföljning"} /></label>
            <label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "Note" : "Notering"}<textarea name="note" required maxLength={1000} rows={5} className={fieldClass} placeholder={isEnglish ? "Write an internal customer note..." : "Skriv en intern kundnotering..."} /></label>
            <button type="submit" className="inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322]">{isEnglish ? "Save note" : "Spara notering"}</button>
          </form>
        </article>

        <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#dfe5dd] pb-4"><div><h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Bookings" : "Bokningar"}</h3><p className="text-sm text-[#5b665f]">{isEnglish ? "Bookings connected to the customer." : "Bokningar kopplade till kunden."}</p></div><span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">{isEnglish ? "Booking data" : "Bokningsdata"}</span></div>
          {bookings.length === 0 ? <p className="mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#5b665f]">{isEnglish ? "No bookings were found for this customer." : "Inga bokningar hittades för den här kunden."}</p> : <div className="mt-5 space-y-3">{bookings.map((booking) => <div key={booking.id} className="grid gap-2 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 sm:grid-cols-[170px_1fr_auto] sm:items-center"><span className="font-bold text-[#17452f]">{booking.time}</span><span><strong>{booking.title}</strong><br /><span className="text-sm text-[#5b665f]">{getBookingMetaText(booking)}</span></span><div className="flex flex-wrap items-center gap-2 sm:justify-end"><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#344139]">{bookingStatuses[booking.status as keyof typeof bookingStatuses] ?? booking.status}</span><Link href={withLang(`/dashboard/bokningar/${booking.id}`, locale)} className="inline-flex min-h-9 items-center justify-center rounded-xl bg-[#173e2b] px-3 py-2 text-xs font-semibold !text-white">{isEnglish ? "View booking" : "Visa bokning"}</Link></div></div>)}</div>}
        </article>
      </div>

      <aside className="rounded-3xl bg-[#17452f] p-6 text-white">
        <h3 className="text-xl font-bold">{isEnglish ? "Customer history" : "Kundhistorik"}</h3><p className="mt-3 text-sm leading-7 text-white/80">{isEnglish ? "Internal notes, booking events and other important customer history are collected here." : "Här samlas interna noteringar, bokningshändelser och annan viktig kundhistorik."}</p>
        <div className="mt-5 space-y-3">{events.length === 0 ? <p className="rounded-2xl bg-white/10 p-4 text-sm text-white/80">{isEnglish ? "No events were found." : "Inga händelser hittades."}</p> : events.map((event) => <div key={event.id} className="rounded-2xl bg-white/10 p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{eventTypes[event.type as keyof typeof eventTypes] ?? event.type}</span><span className="text-xs text-white/70">{event.createdAt}</span></div><p className="mt-3 font-semibold">{event.title}</p><p className="mt-2 text-sm leading-6 text-white/80">{event.description}</p></div>)}</div>
      </aside>
    </section>
  </div>;
}
