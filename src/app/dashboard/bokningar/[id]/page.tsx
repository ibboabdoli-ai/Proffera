import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  Camera,
  CirclePoundSterling,
  CircleUserRound,
  ListChecks,
  RefreshCw,
  StickyNote,
} from "lucide-react";

import { DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { sendBookingRescheduleEmail } from "@/features/email/booking-reschedule-email";
import { sendBookingStatusEmail } from "@/features/email/lead-email";
import { sendBookingCustomerSms } from "@/features/sms/booking-sms";
import { getDashboardBookingDetailInStockholm } from "@/lib/dashboard-booking-detail-db";
import { BookingRescheduleValidationError, rescheduleDashboardBooking } from "@/lib/dashboard-booking-reschedule";
import { isDashboardBookingStatus, updateDashboardBookingStatus, type DashboardBookingStatus } from "@/lib/dashboard-booking-status";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

export const dynamic = "force-dynamic";

const bookingStatusOptions = ["requested", "confirmed", "completed", "cancelled"] as const;
type Locale = "sv" | "en";
type ErrorKey = "access" | "status" | "save" | "reschedule_time" | "reschedule_past" | "reschedule_conflict" | "reschedule_status";
type BookingDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string | string[]; updated?: string | string[]; rescheduled?: string | string[]; created?: string | string[]; lang?: string | string[] }>;
};

type ParsedBookingNotes = {
  estimatedPrice: string;
  minimumCharge: string;
  priceLines: string[];
  priceNotice: string;
  propertyRows: Array<{ label: string; value: string }>;
  customerNote: string;
  photoPaths: string[];
  rawNote: string;
};

const bookingStatusLabels = {
  sv: { draft: "Utkast", requested: "Förfrågad", confirmed: "Bekräftad", completed: "Klar", cancelled: "Avbokad", no_show: "Uteblev" },
  en: { draft: "Draft", requested: "Requested", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" },
};
const customerStatusLabels = {
  sv: { prospect: "Prospekt", active: "Aktiv", paused: "Pausad", lost: "Förlorad" },
  en: { prospect: "Prospect", active: "Active", paused: "Paused", lost: "Lost" },
};
const eventTypeLabels = {
  sv: { note: "Notering", call: "Samtal", email: "E-post", booking: "Bokning", booking_rescheduled: "Ombokning", status_change: "Statusändring", ai_conversation: "AI-dialog" },
  en: { note: "Note", call: "Call", email: "Email", booking: "Booking", booking_rescheduled: "Rescheduled", status_change: "Status change", ai_conversation: "AI conversation" },
};
const errorMessages: Record<Locale, Record<ErrorKey, string>> = {
  sv: {
    access: "Du saknar behörighet att ändra bokningen.", status: "Vald status är ogiltig.", save: "Ändringen kunde inte sparas. Försök igen eller kontrollera konfigurationen.", reschedule_time: "Välj ett giltigt datum och klockslag.", reschedule_past: "Den nya tiden måste ligga i framtiden.", reschedule_conflict: "Den nya tiden krockar med en annan aktiv bokning.", reschedule_status: "En avbokad eller utebliven bokning kan inte flyttas.",
  },
  en: {
    access: "You do not have permission to change this booking.", status: "The selected status is invalid.", save: "The change could not be saved. Try again or check the configuration.", reschedule_time: "Select a valid date and time.", reschedule_past: "The new time must be in the future.", reschedule_conflict: "The new time conflicts with another active booking.", reschedule_status: "A cancelled or no-show booking cannot be rescheduled.",
  },
};

const structuredLabels = new Set([
  "address", "postcode", "property type", "floors", "cleaning", "frames & sills", "standard windows",
  "large windows", "very large / bay windows", "hard-access windows", "frequency", "access", "condition",
  "property size", "heavy blockage", "conservatory size", "solar panels", "area", "heavy dirt / moss",
  "oil / stain treatment", "weed treatment", "re-sanding", "sealing requested", "first clean",
  "rear garden access", "number of floors", "working height", "parking", "window access", "pets at property",
]);

function getFormText(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function withLang(href: string, locale: Locale) { return locale === "en" ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href; }
function redirectWithError(bookingId: string, error: ErrorKey, locale: Locale): never { redirect(withLang(`/dashboard/bokningar/${bookingId}?error=${error}`, locale)); }

function parseBookingNotes(notes: string): ParsedBookingNotes {
  const result: ParsedBookingNotes = {
    estimatedPrice: "",
    minimumCharge: "",
    priceLines: [],
    priceNotice: "",
    propertyRows: [],
    customerNote: "",
    photoPaths: [],
    rawNote: "",
  };
  const lines = notes.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const seenLabels = new Set<string>();
  let recognizedStructuredLine = false;

  for (const line of lines) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const label = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    const normalizedLabel = label.toLowerCase();

    if (normalizedLabel === "pricing") {
      recognizedStructuredLine = true;
      if (/^manual quote required:/i.test(value)) {
        result.estimatedPrice = "Manual quote";
        result.priceNotice = value.replace(/^manual quote required:\s*/i, "");
        continue;
      }
      const segments = value.split("|").map((segment) => segment.trim()).filter(Boolean);
      for (const segment of segments) {
        const priceMatch = segment.match(/^Calculated estimate:\s*(£[\d,.]+)/i);
        if (priceMatch) {
          result.estimatedPrice = priceMatch[1];
          continue;
        }
        const minimumMatch = segment.match(/^Minimum charge:\s*(£[\d,.]+)/i);
        if (minimumMatch) {
          result.minimumCharge = minimumMatch[1];
          continue;
        }
        if (/^(Estimated price|Calculated from)/i.test(segment)) {
          result.priceNotice = segment;
          continue;
        }
        result.priceLines.push(segment);
      }
      continue;
    }

    if (normalizedLabel === "additional details" || normalizedLabel === "arrival notes") {
      recognizedStructuredLine = true;
      result.customerNote = value;
      continue;
    }

    if (normalizedLabel === "photo") {
      recognizedStructuredLine = true;
      if (value.startsWith("primeview-booking/") && !value.includes("..") && value.length <= 800 && result.photoPaths.length < 5) result.photoPaths.push(value);
      continue;
    }

    if (structuredLabels.has(normalizedLabel)) {
      recognizedStructuredLine = true;
      if (!seenLabels.has(normalizedLabel)) {
        seenLabels.add(normalizedLabel);
        result.propertyRows.push({ label, value });
      }
    }
  }

  if (!recognizedStructuredLine) result.rawNote = notes;
  return result;
}

async function requireBookingManager(bookingId: string, locale: Locale) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access) || !(await hasDashboardModuleAccess("online_booking"))) redirectWithError(bookingId, "access", locale);
  return access;
}

async function updateBookingStatusAction(bookingId: string, formData: FormData) {
  "use server";
  const locale: Locale = getFormText(formData, "lang") === "en" ? "en" : "sv";
  const workspaceAccess = await requireBookingManager(bookingId, locale);
  const status = getFormText(formData, "status");
  if (!isDashboardBookingStatus(status)) redirectWithError(bookingId, "status", locale);

  try {
    const result = await updateDashboardBookingStatus(bookingId, status);
    if (result.changed && result.notification && (status === "confirmed" || status === "cancelled")) {
      const notification = result.notification;
      await Promise.allSettled([
        notification.customerEmail ? sendBookingStatusEmail({ customerName: notification.customerName, customerEmail: notification.customerEmail, companyName: workspaceAccess.workspaceName, status, service: notification.service, startsAt: notification.startsAt, endsAt: notification.endsAt, city: notification.city, timeZone: result.timeZone }) : Promise.resolve(null),
        notification.customerPhone ? sendBookingCustomerSms({ customerPhone: notification.customerPhone, companyName: workspaceAccess.workspaceName, status, service: notification.service, startsAt: notification.startsAt, timeZone: result.timeZone }) : Promise.resolve(null),
      ]);
    }
  } catch (error) {
    console.error("Failed to update dashboard booking status", error);
    redirectWithError(bookingId, "save", locale);
  }
  redirect(withLang(`/dashboard/bokningar/${bookingId}?updated=1`, locale));
}

async function rescheduleBookingAction(bookingId: string, formData: FormData) {
  "use server";
  const locale: Locale = getFormText(formData, "lang") === "en" ? "en" : "sv";
  const workspaceAccess = await requireBookingManager(bookingId, locale);
  const startsAt = getFormText(formData, "startsAt");

  try {
    const result = await rescheduleDashboardBooking(bookingId, startsAt);
    if (result.changed && result.notification) {
      const notification = result.notification;
      await Promise.allSettled([
        notification.customerEmail ? sendBookingRescheduleEmail({ customerName: notification.customerName, customerEmail: notification.customerEmail, companyName: workspaceAccess.workspaceName, service: notification.service, previousStartsAt: notification.previousStartsAt, startsAt: notification.startsAt, endsAt: notification.endsAt, city: notification.city, timeZone: result.timeZone }) : Promise.resolve(null),
        notification.customerPhone ? sendBookingCustomerSms({ customerPhone: notification.customerPhone, companyName: workspaceAccess.workspaceName, status: "rescheduled", service: notification.service, previousStartsAt: notification.previousStartsAt, startsAt: notification.startsAt, timeZone: result.timeZone }) : Promise.resolve(null),
      ]);
    }
  } catch (error) {
    if (error instanceof BookingRescheduleValidationError) redirectWithError(bookingId, `reschedule_${error.code}` as ErrorKey, locale);
    console.error("Failed to reschedule dashboard booking", error);
    redirectWithError(bookingId, "save", locale);
  }
  redirect(withLang(`/dashboard/bokningar/${bookingId}?rescheduled=1`, locale));
}

export default async function BookingDetailPage({ params, searchParams }: BookingDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const detail = await getDashboardBookingDetailInStockholm(id);
  if (!detail) notFound();

  const { booking, customer, events } = detail;
  const value = (key: "error" | "updated" | "rescheduled" | "created" | "lang") => { const item = query?.[key]; return Array.isArray(item) ? item[0] : item; };
  const locale: Locale = value("lang") === "en" ? "en" : "sv";
  const isEnglish = locale === "en";
  const errorValue = value("error") as ErrorKey | undefined;
  const errorMessage = errorValue ? errorMessages[locale][errorValue] : undefined;
  const statusAction = updateBookingStatusAction.bind(null, booking.id);
  const rescheduleAction = rescheduleBookingAction.bind(null, booking.id);
  const bookingStatuses = bookingStatusLabels[locale];
  const customerStatuses = customerStatusLabels[locale];
  const eventTypes = eventTypeLabels[locale];
  const parsedNotes = parseBookingNotes(booking.notes);
  const hasCreatedEvent = events.some((event) => event.type === "booking" && /created|skapad|request/i.test(`${event.title} ${event.description}`));
  const historyEvents = hasCreatedEvent ? events : [
    ...events,
    {
      id: `created-${booking.id}`,
      type: "booking",
      title: isEnglish ? "Booking created" : "Bokning skapad",
      description: isEnglish ? "The booking request was created and connected to this customer." : "Bokningsförfrågan skapades och kopplades till kunden.",
      createdAt: booking.createdAt,
    },
  ];
  const metrics = isEnglish ? [
    { label: "Status", value: bookingStatuses[booking.status as keyof typeof bookingStatuses] ?? booking.status, helper: "Current booking status", icon: CalendarClock, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: "Customer", value: booking.customer, helper: "Connected customer profile", icon: CircleUserRound, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Events", value: String(historyEvents.length), helper: "Recorded activities", icon: Activity, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Action", value: "Available", helper: "Status and time can be updated", icon: RefreshCw, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ] as const : [
    { label: "Status", value: bookingStatuses[booking.status as keyof typeof bookingStatuses] ?? booking.status, helper: "Aktuell bokningsstatus", icon: CalendarClock, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: "Kund", value: booking.customer, helper: "Kopplad kundprofil", icon: CircleUserRound, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Händelser", value: String(historyEvents.length), helper: "Registrerade aktiviteter", icon: Activity, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Åtgärd", value: "Tillgänglig", helper: "Status och tid kan uppdateras", icon: RefreshCw, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ] as const;
  const fieldClass = "rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20";

  return <div className="grid gap-6">
    <DashboardPageHeader eyebrow={isEnglish ? "Booking profile" : "Bokningsprofil"} title={booking.title} description={isEnglish ? "View the booking details, connected customer and history. Change the status or reschedule the time securely." : "Se bokningens viktigaste uppgifter, kopplad kund och historik. Ändra status eller flytta tiden kontrollerat."} icon={CalendarClock} actions={<Link href={withLang("/dashboard/bokningar", locale)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f]"><ArrowLeft className="h-4 w-4" />{isEnglish ? "Back to bookings" : "Tillbaka till bokningar"}</Link>} />
    {errorMessage ? <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{errorMessage}</section> : null}
    {value("created") === "1" ? <section className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">{isEnglish ? "The booking was created successfully." : "Bokningen skapades."}</section> : null}
    {value("updated") === "1" ? <section className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">{isEnglish ? "The status was updated and saved in the history." : "Status uppdaterades och ändringen sparades i historiken."}</section> : null}
    {value("rescheduled") === "1" ? <section className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">{isEnglish ? "The booking was rescheduled. The previous and new times were saved, and the customer was notified when contact details were available." : "Bokningen flyttades. Den tidigare och nya tiden sparades i historiken och kunden notifierades när kontaktuppgifter fanns."}</section> : null}
    <DashboardMetricGrid items={metrics} />

    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Booking" : "Bokning"}</h3>
          <div className="mt-5 grid gap-3 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139] sm:grid-cols-2">
            <p><strong>Start:</strong> {booking.time}</p><p><strong>{isEnglish ? "End:" : "Slut:"}</strong> {booking.endsAt}</p>
            <p><strong>{isEnglish ? "Location:" : "Ort:"}</strong> {booking.city}</p><p><strong>{isEnglish ? "Service:" : "Tjänst:"}</strong> {booking.service}</p>
            <p><strong>{isEnglish ? "Created:" : "Skapad:"}</strong> {booking.createdAt}</p>
          </div>
        </article>

        {parsedNotes.estimatedPrice ? <article className="overflow-hidden rounded-[24px] border border-[#d5e4f5] bg-white shadow-sm">
          <div className="flex flex-col gap-4 bg-[#071b42] p-6 text-white sm:flex-row sm:items-end sm:justify-between">
            <div><p className="flex items-center gap-2 text-sm font-bold text-[#bcd5ff]"><CirclePoundSterling className="h-5 w-5" />{isEnglish ? "Customer price estimate" : "Kundens prisindikation"}</p><p className="mt-2 text-4xl font-black tracking-tight">{parsedNotes.estimatedPrice}</p></div>
            {parsedNotes.minimumCharge ? <div className="rounded-xl bg-white/10 px-4 py-3 text-sm"><span className="text-white/70">{isEnglish ? "Minimum charge" : "Minimipris"}</span><strong className="ml-2">{parsedNotes.minimumCharge}</strong></div> : null}
          </div>
          <div className="p-6">
            {parsedNotes.priceLines.length ? <div className="grid gap-2">{parsedNotes.priceLines.map((line) => <div key={line} className="flex items-start gap-3 rounded-xl border border-[#e3eaf3] bg-[#f8fbff] px-4 py-3 text-sm text-[#34485f]"><ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[#2769b5]" /><span>{line}</span></div>)}</div> : null}
            {parsedNotes.priceNotice ? <p className="mt-4 rounded-xl bg-[#fff8e8] p-4 text-sm leading-6 text-[#73551b]">{parsedNotes.priceNotice}</p> : null}
          </div>
        </article> : null}

        {parsedNotes.propertyRows.length ? <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><ListChecks className="h-5 w-5 text-[#17452f]" /><h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Property & job details" : "Fastighet & jobbdetaljer"}</h3></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{parsedNotes.propertyRows.map((row) => <div key={row.label.toLowerCase()} className="rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#718077]">{row.label}</p><p className="mt-1 font-semibold text-[#26362d]">{row.value}</p></div>)}</div>
        </article> : null}

        {parsedNotes.photoPaths.length ? <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><Camera className="h-5 w-5 text-[#17452f]" /><h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Property photos" : "Fastighetsbilder"}</h3></div>
          <p className="mt-2 text-sm text-[#5b665f]">{isEnglish ? "Photos supplied by the customer for access and price review." : "Bilder som kunden skickade för åtkomst- och prisbedömning."}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{parsedNotes.photoPaths.map((pathname, index) => { const src = `/api/primeview/booking-photo?pathname=${encodeURIComponent(pathname)}`; return <a key={pathname} href={src} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-[#e4e9e2] bg-[#f7f9f6]"><Image src={src} alt={`Property photo ${index + 1}`} width={720} height={480} unoptimized className="aspect-[3/2] w-full object-cover" /></a>; })}</div>
        </article> : null}

        {parsedNotes.customerNote || parsedNotes.rawNote ? <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3"><StickyNote className="h-5 w-5 text-[#17452f]" /><h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Customer notes" : "Kundnotering"}</h3></div>
          <p className="mt-4 whitespace-pre-wrap rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-7 text-[#344139]">{parsedNotes.customerNote || parsedNotes.rawNote}</p>
        </article> : null}

        <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm"><h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Change time" : "Ändra tid"}</h3><p className="mt-3 text-sm leading-7 text-[#5b665f]">{isEnglish ? "Select a new start time. The current duration is preserved, conflicts are blocked, and the customer receives SMS and email when contact details are available." : "Välj en ny starttid. Bokningens nuvarande längd behålls, krockar blockeras och kunden får SMS och e-post när kontaktuppgifter finns."}</p><form action={rescheduleAction} className="mt-5 grid gap-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4"><input type="hidden" name="lang" value={locale} /><label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "New start time" : "Ny starttid"}<input name="startsAt" type="datetime-local" required className={fieldClass} /></label><button type="submit" className="inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322]">{isEnglish ? "Reschedule booking" : "Flytta bokning"}</button></form></article>

        <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm"><h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Change status" : "Ändra status"}</h3><p className="mt-3 text-sm leading-7 text-[#5b665f]">{isEnglish ? "Confirmation or cancellation sends email and SMS when the customer has provided contact details." : "Vid bekräftelse eller avbokning skickas e-post och SMS när kunden har lämnat kontaktuppgifter."}</p><form action={statusAction} className="mt-5 grid gap-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4"><input type="hidden" name="lang" value={locale} /><label className="grid gap-2 text-sm font-semibold text-[#17201a]">{isEnglish ? "New status" : "Ny status"}<select name="status" defaultValue={bookingStatusOptions.includes(booking.status as DashboardBookingStatus) ? booking.status : "requested"} className={fieldClass}>{bookingStatusOptions.map((status) => <option key={status} value={status}>{bookingStatuses[status]}</option>)}</select></label><button type="submit" className="inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322]">{isEnglish ? "Update status" : "Uppdatera status"}</button></form></article>

        <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm"><div className="flex items-center justify-between border-b border-[#dfe5dd] pb-4"><div><h3 className="text-xl font-bold text-[#17201a]">{isEnglish ? "Connected customer" : "Kopplad kund"}</h3><p className="text-sm text-[#5b665f]">{isEnglish ? "Customer details connected to the booking." : "Kunduppgifter kopplade till bokningen."}</p></div><span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">{isEnglish ? "Customer data" : "Kunddata"}</span></div>{!customer ? <p className="mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#5b665f]">{isEnglish ? "No customer is connected to this booking." : "Ingen kund är kopplad till den här bokningen."}</p> : <div className="mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139]"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-lg font-bold text-[#17201a]">{customer.name}</p><p className="mt-1 text-[#5b665f]">{customer.type} · {customer.city}</p><p className="mt-3"><strong>Status:</strong> {customerStatuses[customer.status as keyof typeof customerStatuses] ?? customer.status}</p><p><strong>{isEnglish ? "Email:" : "E-post:"}</strong> {customer.email}</p><p><strong>{isEnglish ? "Phone:" : "Telefon:"}</strong> {customer.phone}</p></div><Link href={withLang(`/dashboard/kunder/${customer.id}`, locale)} className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#0f3322] px-4 py-2 text-sm font-bold !text-white shadow-sm">{isEnglish ? "View customer profile" : "Visa kundprofil"}</Link></div></div>}</article>
      </div>

      <aside className="rounded-3xl bg-[#17452f] p-6 text-white"><h3 className="text-xl font-bold">{isEnglish ? "Booking history" : "Bokningshistorik"}</h3><p className="mt-3 text-sm leading-7 text-white/80">{isEnglish ? "Status changes, rescheduling and important booking events are collected here." : "Här samlas statusändringar, ombokningar och viktiga händelser kopplade till bokningen."}</p><div className="mt-5 space-y-3">{historyEvents.map((event) => <div key={event.id} className="rounded-2xl bg-white/10 p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{eventTypes[event.type as keyof typeof eventTypes] ?? event.type}</span><span className="text-xs text-white/70">{event.createdAt}</span></div><p className="mt-3 font-semibold">{event.title}</p><p className="mt-2 text-sm leading-6 text-white/80">{event.description}</p></div>)}</div></aside>
    </section>
  </div>;
}
