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

const connectionString = resolveDatabaseUrl();
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
    { label: "Status", value: customerStatuses[customer.status as keyof typeof customerStatuses] ?? customer.status, helper: "Current CRM status", icon: UserRound, tone: "bg-brand-soft text-brand" },
    { label: "Bookings", value: String(bookings.length), helper: "Connected bookings", icon: CalendarCheck2, tone: "bg-brand-tint text-brand" },
    { label: "Events", value: String(events.length), helper: "Recorded activities", icon: Activity, tone: "bg-accent-soft/25 text-ink" },
    { label: "Notes", value: "Internal", helper: "Controlled customer notes", icon: MessageSquareText, tone: "bg-surface-subtle text-ink-muted" },
  ] as const : [
    { label: "Status", value: customerStatuses[customer.status as keyof typeof customerStatuses] ?? customer.status, helper: "Aktuell CRM-status", icon: UserRound, tone: "bg-brand-soft text-brand" },
    { label: "Bokningar", value: String(bookings.length), helper: "Kopplade bokningar", icon: CalendarCheck2, tone: "bg-brand-tint text-brand" },
    { label: "Händelser", value: String(events.length), helper: "Registrerade aktiviteter", icon: Activity, tone: "bg-accent-soft/25 text-ink" },
    { label: "Noteringar", value: "Intern", helper: "Kontrollerad kundnotering", icon: MessageSquareText, tone: "bg-surface-subtle text-ink-muted" },
  ] as const;
  const fieldClass = "min-h-12 rounded-control border border-line bg-surface px-4 py-3 text-sm font-normal text-ink outline-none transition placeholder:text-ink-muted/60 hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15";

  return <div className="grid gap-6">
    <DashboardPageHeader eyebrow={isEnglish ? "Customer profile" : "Kundprofil"} title={customer.name} description={isEnglish ? "View the customer profile, bookings and history. Internal notes can be saved securely." : "Se kundens profil, bokningar och historik. Interna noteringar kan sparas kontrollerat med rätt behörighet."} icon={UserRound} actions={<Link href={withLang("/dashboard/kunder", locale)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-bold text-brand transition hover:-translate-y-0.5 hover:border-line-strong hover:bg-brand-tint"><ArrowLeft className="h-4 w-4" />{isEnglish ? "Back to customers" : "Tillbaka till kunder"}</Link>} />
    {errorMessage ? <section className="rounded-card border border-danger/20 bg-danger/5 p-5 text-sm font-semibold text-danger shadow-card">{errorMessage}</section> : null}
    {value("created") === "1" ? <section className="rounded-card border border-brand/15 bg-brand-tint p-5 text-sm font-semibold text-brand shadow-card">{isEnglish ? "The customer was created and the profile is ready for the next step." : "Kunden skapades och profilen är redo för nästa steg."}</section> : null}
    {value("note") === "created" ? <section className="rounded-card border border-brand/15 bg-brand-tint p-5 text-sm font-semibold text-brand shadow-card">{isEnglish ? "The note was saved in the customer history. No booking was changed and no email was sent." : "Noteringen sparades i kundhistoriken. Ingen bokning ändrades och ingen e-post skickades."}</section> : null}
    <DashboardMetricGrid items={metrics} />

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid gap-6">
        <article className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="border-b border-line pb-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{isEnglish ? "Customer record" : "Kundkort"}</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-ink">{isEnglish ? "Profile details" : "Profiluppgifter"}</h3>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <p className="rounded-card border border-line bg-surface-subtle p-4 text-sm text-ink-muted"><strong className="block text-xs uppercase tracking-[0.08em] text-ink">{isEnglish ? "Customer type" : "Kundtyp"}</strong><span className="mt-1 block">{customer.type}</span></p>
            <p className="rounded-card border border-line bg-surface-subtle p-4 text-sm text-ink-muted"><strong className="block text-xs uppercase tracking-[0.08em] text-ink">{isEnglish ? "Location" : "Ort"}</strong><span className="mt-1 block">{customer.city}</span></p>
            <p className="rounded-card border border-line bg-surface-subtle p-4 text-sm text-ink-muted"><strong className="block text-xs uppercase tracking-[0.08em] text-ink">{isEnglish ? "Email" : "E-post"}</strong><span className="mt-1 block break-all">{customer.email}</span></p>
            <p className="rounded-card border border-line bg-surface-subtle p-4 text-sm text-ink-muted"><strong className="block text-xs uppercase tracking-[0.08em] text-ink">{isEnglish ? "Phone" : "Telefon"}</strong><span className="mt-1 block">{customer.phone}</span></p>
            <p className="rounded-card border border-line bg-surface-subtle p-4 text-sm text-ink-muted"><strong className="block text-xs uppercase tracking-[0.08em] text-ink">{isEnglish ? "Company" : "Företag"}</strong><span className="mt-1 block">{customer.companyName}</span></p>
            <p className="rounded-card border border-line bg-surface-subtle p-4 text-sm text-ink-muted"><strong className="block text-xs uppercase tracking-[0.08em] text-ink">{isEnglish ? "Service" : "Tjänst"}</strong><span className="mt-1 block">{customer.service}</span></p>
            <p className="rounded-card border border-line bg-surface-subtle p-4 text-sm text-ink-muted sm:col-span-2"><strong className="block text-xs uppercase tracking-[0.08em] text-ink">{isEnglish ? "Created" : "Skapad"}</strong><span className="mt-1 block">{customer.createdAt}</span></p>
          </div>
          <div className="mt-4 rounded-card border border-line bg-brand-tint p-4 text-sm leading-7 text-ink-muted"><strong className="text-ink">{isEnglish ? "Customer notes:" : "Kundnotering:"}</strong> {customer.notes}</div>
        </article>

        <article className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">{isEnglish ? "CRM activity" : "CRM-aktivitet"}</p>
            <h3 className="mt-2 text-xl font-bold tracking-tight text-ink">{isEnglish ? "Add internal note" : "Lägg till intern notering"}</h3>
            <p className="mt-2 text-sm leading-7 text-ink-muted">{isEnglish ? "Save an internal note in the customer history. No booking is changed and no email is sent." : "Sparar en intern notering i kundhistoriken. Ingen bokning ändras och ingen e-post skickas."}</p>
          </div>
          <form action={noteAction} className="mt-5 grid gap-4 rounded-card border border-line bg-surface-subtle p-4 sm:p-5">
            <input type="hidden" name="lang" value={locale} />
            <label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "Title" : "Rubrik"}<input name="title" type="text" required maxLength={140} className={fieldClass} placeholder={isEnglish ? "For example: Follow-up" : "Till exempel: Uppföljning"} /></label>
            <label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "Note" : "Notering"}<textarea name="note" required maxLength={1000} rows={5} className={fieldClass} placeholder={isEnglish ? "Write an internal customer note..." : "Skriv en intern kundnotering..."} /></label>
            <button type="submit" className="inline-flex min-h-12 w-fit items-center justify-center rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-brand-hover">{isEnglish ? "Save note" : "Spara notering"}</button>
          </form>
        </article>

        <article className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">CRM</p><h3 className="mt-2 text-xl font-bold tracking-tight text-ink">{isEnglish ? "Bookings" : "Bokningar"}</h3><p className="mt-1 text-sm text-ink-muted">{isEnglish ? "Bookings connected to the customer." : "Bokningar kopplade till kunden."}</p></div>
            <span className="w-fit rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">{isEnglish ? "Booking data" : "Bokningsdata"}</span>
          </div>
          {bookings.length === 0 ? <p className="mt-5 rounded-card border border-dashed border-line-strong bg-surface-subtle p-5 text-sm text-ink-muted">{isEnglish ? "No bookings were found for this customer." : "Inga bokningar hittades för den här kunden."}</p> : <div className="mt-5 space-y-3">{bookings.map((booking) => <div key={booking.id} className="grid gap-3 rounded-card border border-line bg-surface-subtle p-4 sm:grid-cols-[170px_1fr_auto] sm:items-center"><span className="font-bold text-brand">{booking.time}</span><span className="text-ink"><strong>{booking.title}</strong><br /><span className="text-sm text-ink-muted">{getBookingMetaText(booking)}</span></span><div className="flex flex-wrap items-center gap-2 sm:justify-end"><span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink-muted">{bookingStatuses[booking.status as keyof typeof bookingStatuses] ?? booking.status}</span><Link href={withLang(`/dashboard/bokningar/${booking.id}`, locale)} className="inline-flex min-h-9 items-center justify-center rounded-control bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-hover">{isEnglish ? "View booking" : "Visa bokning"}</Link></div></div>)}</div>}
        </article>
      </div>

      <aside className="h-fit rounded-panel bg-brand-deep p-5 text-white shadow-lift sm:p-6 xl:sticky xl:top-24">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">CRM timeline</p>
        <h3 className="mt-2 text-xl font-bold">{isEnglish ? "Customer history" : "Kundhistorik"}</h3><p className="mt-3 text-sm leading-7 text-white/75">{isEnglish ? "Internal notes, booking events and other important customer history are collected here." : "Här samlas interna noteringar, bokningshändelser och annan viktig kundhistorik."}</p>
        <div className="mt-5 space-y-3">{events.length === 0 ? <p className="rounded-card border border-white/10 bg-white/[0.06] p-4 text-sm text-white/75">{isEnglish ? "No events were found." : "Inga händelser hittades."}</p> : events.map((event) => <div key={event.id} className="rounded-card border border-white/10 bg-white/[0.07] p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">{eventTypes[event.type as keyof typeof eventTypes] ?? event.type}</span><span className="text-xs text-white/60">{event.createdAt}</span></div><p className="mt-3 font-semibold text-white">{event.title}</p><p className="mt-2 text-sm leading-6 text-white/75">{event.description}</p></div>)}</div>
      </aside>
    </section>
  </div>;
}
