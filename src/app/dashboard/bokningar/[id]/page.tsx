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

import { DashboardActionFeedback } from "@/components/dashboard/dashboard-action-feedback";
import { DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { MariaSwishPaymentControl } from "@/components/dashboard/maria-swish-payment-control";
import { MariaStatusEmailRetryButton } from "@/components/dashboard/maria-status-email-retry-button";
import { sendBookingRescheduleEmail } from "@/features/email/booking-reschedule-email";
import { sendBookingStatusEmail } from "@/features/email/lead-email";
import { sendMariaBookingStatusEmail } from "@/features/email/maria-deposit-email";
import { sendBookingCustomerSms } from "@/features/sms/booking-sms";
import { getDashboardBookingDetailInStockholm } from "@/lib/dashboard-booking-detail-db";
import { getSql } from "@/lib/db/server";
import { resolveBrevoApiKey } from "@/lib/email-runtime-config";
import { BookingRescheduleValidationError, rescheduleDashboardBooking } from "@/lib/dashboard-booking-reschedule";
import { isDashboardBookingStatus, updateDashboardBookingStatus, type DashboardBookingStatus } from "@/lib/dashboard-booking-status";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";
import { MARIA_DEPOSIT_AMOUNT_SEK, MARIA_SWISH_NUMBER, mariaSwishQrPath } from "@/lib/maria-deposit";
import { readMariaManualSwishStatuses } from "@/lib/maria-manual-swish";
import { readMariaSwishQrEligibility } from "@/lib/maria-swish-qr-eligibility";
import { getMariaPreviewPortalBase, isMariaPreviewTestRecipient, mariaPreviewStatusChangePreflight } from "@/lib/maria-preview-customer-safety";

export const dynamic = "force-dynamic";

const bookingStatusOptions = ["requested", "confirmed", "completed", "cancelled"] as const;
type Locale = "sv" | "en";
type ErrorKey = "access" | "status" | "save" | "maria_preview" | "maria_email_setup" | "reschedule_time" | "reschedule_past" | "reschedule_conflict" | "reschedule_status" | "maria_activation_conflict";
type BookingDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string | string[]; updated?: string | string[]; rescheduled?: string | string[]; created?: string | string[]; maria_mail?: string | string[]; payment_saved?: string | string[]; payment_error?: string | string[]; lang?: string | string[] }>;
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
    access: "Du saknar behörighet att ändra bokningen.", status: "Vald status är ogiltig.", save: "Ändringen kunde inte sparas. Försök igen eller kontrollera konfigurationen.", maria_preview: "Maria-bokningar kan endast uppdateras med en godkänd testmottagare i isolerad Preview.", maria_email_setup: "Bokningen ändrades inte: Preview-e-post måste vara konfigurerad för bekräftelse och avbokning.", reschedule_time: "Välj ett giltigt datum och klockslag.", reschedule_past: "Den nya tiden måste ligga i framtiden.", reschedule_conflict: "Den nya tiden krockar med en annan aktiv bokning.", reschedule_status: "En avbokad eller utebliven bokning kan inte flyttas.", maria_activation_conflict: "Bokningen kunde inte återaktiveras eftersom tiden är stängd eller upptagen.",
  },
  en: {
    access: "You do not have permission to change this booking.", status: "The selected status is invalid.", save: "The change could not be saved. Try again or check the configuration.", maria_preview: "Maria booking changes are limited to the approved QA recipient in isolated Preview.", maria_email_setup: "Booking unchanged: Preview email must be configured for confirmation and cancellation.", reschedule_time: "Select a valid date and time.", reschedule_past: "The new time must be in the future.", reschedule_conflict: "The new time conflicts with another active booking.", reschedule_status: "A cancelled or no-show booking cannot be rescheduled.", maria_activation_conflict: "This booking cannot be reactivated because the time is closed or occupied.",
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

  const isMaria = workspaceAccess.workspaceSlug === "makeup-by-maria";
  // Validate the workspace-scoped QA recipient for ALL Maria status changes
  // before the writer runs. Email-sending statuses also require email setup.
  if (isMaria) {
    const current = await getDashboardBookingDetailInStockholm(bookingId);
    const preflightError = mariaPreviewStatusChangePreflight(
      status, current?.customer?.email, Boolean(resolveBrevoApiKey() && process.env.LEAD_FROM_EMAIL),
    );
    if (preflightError) redirectWithError(bookingId, preflightError, locale);
  }

  let mariaMailFailed = false;
  let statusChanged = false;
  let previousStatus: string | null = null;
  try {
    const result = await updateDashboardBookingStatus(bookingId, status);
    statusChanged = result.changed;
    previousStatus = result.previousStatus;
    if (result.changed && result.notification && (status === "confirmed" || status === "cancelled")) {
      const notification = result.notification;
      if (isMaria) {
        // Recheck the returned recipient; no Maria SMS or unapproved inbox.
        const delivery = isMariaPreviewTestRecipient(notification.customerEmail)
          ? await sendMariaBookingStatusEmail({
              bookingId, status, customerName: notification.customerName,
              customerEmail: notification.customerEmail, companyName: workspaceAccess.workspaceName,
              service: notification.service, startsAt: notification.startsAt,
              endsAt: notification.endsAt, city: notification.city, timeZone: result.timeZone,
              language: notification.language,
              confirmedAt: notification.confirmedAt ? new Date(notification.confirmedAt) : undefined,
            })
          : { ok: false as const };
        mariaMailFailed = !delivery.ok;
      } else {
        await Promise.allSettled([
          notification.customerEmail ? sendBookingStatusEmail({ customerName: notification.customerName, customerEmail: notification.customerEmail, companyName: workspaceAccess.workspaceName, status, service: notification.service, startsAt: notification.startsAt, endsAt: notification.endsAt, city: notification.city, timeZone: result.timeZone }) : Promise.resolve(null),
          notification.customerPhone ? sendBookingCustomerSms({ customerPhone: notification.customerPhone, companyName: workspaceAccess.workspaceName, status, service: notification.service, startsAt: notification.startsAt, timeZone: result.timeZone }) : Promise.resolve(null),
        ]);
      }
    }
  } catch (error) {
    console.error("Failed to update dashboard booking status", error);
    redirectWithError(bookingId, "save", locale);
  }
  if (isMaria && !statusChanged && status !== "cancelled") {
    if (previousStatus === "cancelled" || previousStatus === "no_show") redirectWithError(bookingId, "maria_activation_conflict", locale);
    // Already at the requested status: no change occurred; do not claim an update.
    redirect(withLang(`/dashboard/bokningar/${bookingId}`, locale));
  }
  redirect(withLang(`/dashboard/bokningar/${bookingId}?updated=1${mariaMailFailed ? "&maria_mail=failed" : ""}`, locale));
}


/** Explicit manager-initiated retry. Never change booking status or bypass Preview recipient rules. */
async function resendMariaStatusEmailAction(bookingId: string, formData: FormData) {
  "use server";
  const locale: Locale = getFormText(formData, "lang") === "en" ? "en" : "sv";
  const access = await requireBookingManager(bookingId, locale);
  if (process.env.VERCEL_ENV !== "preview" || access.workspaceSlug !== "makeup-by-maria"
    || !getMariaPreviewPortalBase()) redirectWithError(bookingId, "maria_preview", locale);
  if (!resolveBrevoApiKey() || !process.env.LEAD_FROM_EMAIL) {
    redirectWithError(bookingId, "maria_email_setup", locale);
  }
  const approved = process.env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim().toLowerCase() ?? "";
  if (!approved || !isMariaPreviewTestRecipient(approved)) {
    redirectWithError(bookingId, "maria_preview", locale);
  }
  const sql = getSql();
  if (!sql) redirectWithError(bookingId, "save", locale);
  let row: Record<string, unknown> | undefined;
  try {
    const rows = await sql`
      select b.status,b.service,b.city,b.starts_at,b.ends_at,
        c.name as customer_name,c.email as customer_email,
        (select e.created_at from customer_events e
          where e.workspace_id=b.workspace_id and e.booking_id=b.id
            and e.event_type='status_change' and e.metadata->>'new_status'='confirmed'
          order by e.created_at desc,e.id desc limit 1) as confirmed_at,
        (select e.metadata->>'language' from customer_events e
          where e.workspace_id=b.workspace_id and e.booking_id=b.id
            and e.event_type='booking' and e.metadata->>'source'='public_booking'
            and e.metadata->>'language' in ('sv','en','ar')
          order by e.created_at desc,e.id desc limit 1) as booking_language
      from bookings b
      join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
      where b.workspace_id=${access.workspaceId} and b.id=${bookingId}::uuid
        and b.source='public_booking' and b.status in ('confirmed','cancelled')
        and lower(trim(c.email))=${approved}
      limit 1
    `;
    row = rows[0] as Record<string, unknown> | undefined;
  } catch (error) {
    console.error("Maria Preview email retry lookup failed", error);
    redirectWithError(bookingId, "save", locale);
  }
  if (!row || !isMariaPreviewTestRecipient(String(row.customer_email ?? ""))) {
    redirectWithError(bookingId, "maria_preview", locale);
  }
  // Resending must not reset the customer's original 24-hour deposit deadline.
  const confirmedAt = row.status === "confirmed"
    ? new Date(String(row.confirmed_at ?? "")) : undefined;
  if (row.status === "confirmed"
    && (!row.confirmed_at || !confirmedAt || !Number.isFinite(confirmedAt.getTime()))) {
    redirectWithError(bookingId, "save", locale);
  }
  const sent = await sendMariaBookingStatusEmail({
    bookingId, status: row.status === "confirmed" ? "confirmed" : "cancelled",
    customerName: String(row.customer_name ?? ""),
    customerEmail: String(row.customer_email ?? ""),
    companyName: access.workspaceName,
    service: String(row.service ?? ""), startsAt: new Date(String(row.starts_at)).toISOString(),
    endsAt: new Date(String(row.ends_at)).toISOString(),
    city: String(row.city ?? ""), timeZone: "Europe/Stockholm",
    confirmedAt, language: row.booking_language === "ar" ? "ar"
      : row.booking_language === "en" ? "en" : "sv",
  });
  if (!sent.ok) redirect(withLang(`/dashboard/bokningar/${bookingId}?maria_mail=failed`, locale));
  redirect(withLang(`/dashboard/bokningar/${bookingId}?maria_mail=resent`, locale));
}

async function rescheduleBookingAction(bookingId: string, formData: FormData) {
  "use server";
  const locale: Locale = getFormText(formData, "lang") === "en" ? "en" : "sv";
  const workspaceAccess = await requireBookingManager(bookingId, locale);
  const startsAt = getFormText(formData, "startsAt");

  const isMaria = workspaceAccess.workspaceSlug === "makeup-by-maria";
  if (isMaria) {
    const current = await getDashboardBookingDetailInStockholm(bookingId);
    if (!getMariaPreviewPortalBase() || !current?.customer
      || !isMariaPreviewTestRecipient(current.customer.email)) {
      redirectWithError(bookingId, "maria_preview", locale);
    }
  }

  try {
    const result = await rescheduleDashboardBooking(bookingId, startsAt);
    if (result.changed && result.notification) {
      const notification = result.notification;
      if (isMaria) {
        // Maria Preview reschedules never send an SMS to a real phone.
        if (isMariaPreviewTestRecipient(notification.customerEmail)) {
          await sendBookingRescheduleEmail({
            customerName: notification.customerName, customerEmail: notification.customerEmail,
            companyName: workspaceAccess.workspaceName, branding: "makeup-by-maria", service: notification.service,
            previousStartsAt: notification.previousStartsAt, startsAt: notification.startsAt,
            endsAt: notification.endsAt, city: notification.city, timeZone: result.timeZone,
            language: notification.language,
          });
        }
      } else {
        await Promise.allSettled([
          notification.customerEmail ? sendBookingRescheduleEmail({ customerName: notification.customerName, customerEmail: notification.customerEmail, companyName: workspaceAccess.workspaceName, service: notification.service, previousStartsAt: notification.previousStartsAt, startsAt: notification.startsAt, endsAt: notification.endsAt, city: notification.city, timeZone: result.timeZone }) : Promise.resolve(null),
          notification.customerPhone ? sendBookingCustomerSms({ customerPhone: notification.customerPhone, companyName: workspaceAccess.workspaceName, status: "rescheduled", service: notification.service, previousStartsAt: notification.previousStartsAt, startsAt: notification.startsAt, timeZone: result.timeZone }) : Promise.resolve(null),
        ]);
      }
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
  // Layout and child pages may render concurrently; do not read a booking
  // until this request has a valid workspace membership.
  const access = await getUserWorkspaceAccess();
  if (!access.ok) {
    if (access.reason === "no_session") redirect("/logga-in");
    notFound();
  }
  const detail = await getDashboardBookingDetailInStockholm(id);
  if (!detail) notFound();

  const { booking, customer, events } = detail;
  const mariaPreview = access.workspaceSlug === "makeup-by-maria"
    && canManageWorkspaceSettings(access) && process.env.VERCEL_ENV === "preview";
  const manualSwish = mariaPreview ? await readMariaManualSwishStatuses() : null;
  const mariaQrEligibility = mariaPreview && manualSwish?.ok === true && manualSwish.entries[booking.id]
    ? await readMariaSwishQrEligibility(booking.id).catch((error) => {
        console.error("Maria Preview Swish QR eligibility could not be read", error);
        return "unavailable" as const;
      })
    : "unavailable";
  const value = (key: "error" | "updated" | "rescheduled" | "created" | "maria_mail" | "payment_saved" | "payment_error" | "lang") => { const item = query?.[key]; return Array.isArray(item) ? item[0] : item; };
  const locale: Locale = value("lang") === "en" ? "en" : "sv";
  const isEnglish = locale === "en";
  const errorValue = value("error") as ErrorKey | undefined;
  const errorMessage = errorValue ? errorMessages[locale][errorValue] : undefined;
  const mariaEmailWarning = value("maria_mail") === "failed"
    ? isEnglish
      ? "The booking status was saved, but the Maria customer email could not be delivered. Contact the approved QA recipient manually."
      : "Bokningsstatusen sparades, men Marias kundmejl kunde inte skickas. Kontakta den godkända QA-mottagaren manuellt."
    : undefined;
  const statusAction = updateBookingStatusAction.bind(null, booking.id);
  const resendStatusAction = resendMariaStatusEmailAction.bind(null, booking.id);
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
    { label: "Status", value: bookingStatuses[booking.status as keyof typeof bookingStatuses] ?? booking.status, helper: "Current booking status", icon: CalendarClock, tone: "bg-[#e9f2ec] text-brand" },
    { label: "Customer", value: booking.customer, helper: "Connected customer profile", icon: CircleUserRound, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Events", value: String(historyEvents.length), helper: "Recorded activities", icon: Activity, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Action", value: "Available", helper: "Status and time can be updated", icon: RefreshCw, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ] as const : [
    { label: "Status", value: bookingStatuses[booking.status as keyof typeof bookingStatuses] ?? booking.status, helper: "Aktuell bokningsstatus", icon: CalendarClock, tone: "bg-[#e9f2ec] text-brand" },
    { label: "Kund", value: booking.customer, helper: "Kopplad kundprofil", icon: CircleUserRound, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Händelser", value: String(historyEvents.length), helper: "Registrerade aktiviteter", icon: Activity, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Åtgärd", value: "Tillgänglig", helper: "Status och tid kan uppdateras", icon: RefreshCw, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ] as const;
  const fieldClass = "rounded-control border border-[#dce4ee] px-4 py-3 text-sm font-normal text-ink outline-none transition focus:border-[#1469d8] focus:ring-2 focus:ring-[#1469d8]/20";
  const successMessage = value("maria_mail") === "resent"
    ? (isEnglish ? "Status email was resent to the approved QA inbox." : "Statusmejlet skickades om till godkänd QA-inkorg.")
    : value("rescheduled") === "1"
    ? isEnglish
      ? "The booking was rescheduled. The previous and new times were saved, and the customer was notified when contact details were available."
      : "Bokningen flyttades. Den tidigare och nya tiden sparades i historiken och kunden notifierades när kontaktuppgifter fanns."
    : value("updated") === "1"
      ? isEnglish
        ? "The status was updated and saved in the history."
        : "Status uppdaterades och ändringen sparades i historiken."
      : value("created") === "1"
        ? isEnglish
          ? "The booking was created successfully."
          : "Bokningen skapades."
        : null;

  return <div className="grid gap-6">
    <DashboardPageHeader eyebrow={isEnglish ? "Booking profile" : "Bokningsprofil"} title={booking.title} description={isEnglish ? "View the booking details, connected customer and history. Change the status or reschedule the time securely." : "Se bokningens viktigaste uppgifter, kopplad kund och historik. Ändra status eller flytta tiden kontrollerat."} icon={CalendarClock} actions={<Link href={withLang("/dashboard/bokningar", locale)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-[#d5ddd3] bg-surface px-4 py-2.5 text-sm font-bold text-brand"><ArrowLeft className="h-4 w-4" />{isEnglish ? "Back to bookings" : "Tillbaka till bokningar"}</Link>} />
    <DashboardActionFeedback statusMessage={successMessage} alertMessage={errorMessage ?? mariaEmailWarning} />
    <DashboardMetricGrid items={metrics} />
    {mariaPreview && manualSwish?.ok === false ? (
      <p role="alert" className="rounded-lg bg-[#fff0ee] p-3 text-sm font-semibold text-[#a33b2f]">
        {isEnglish ? "Swish payment status could not be read. Try again." : "Swish-betalningsstatus kunde inte läsas. Försök igen."}
      </p>
    ) : null}
    {mariaPreview && manualSwish?.entries[booking.id] ? (
      <section className="rounded-card border border-[#e8d9dc] bg-[#fff9f8] p-5 shadow-sm sm:p-6">
        <h2 className="font-serif text-xl font-bold text-[#704858]">{isEnglish ? "Makeup by Maria · Swish deposit (Preview)" : "Makeup by Maria · Swish-handpenning (Preview)"}</h2>
        <p className="mt-2 text-sm text-[#6a525b]">
          {isEnglish
            ? `After manual confirmation, the approved QA inbox receives an email explaining the ${MARIA_DEPOSIT_AMOUNT_SEK.toLocaleString("sv-SE")} SEK deposit, 24-hour deadline and unique booking reference. Check the payment yourself in Swish; Maria alone can cancel an unpaid booking. No automatic bank verification or SMS.`
            : <>Vid manuell bekräftelse får den godkända QA-mottagaren ett mejl med
              handpenning på {MARIA_DEPOSIT_AMOUNT_SEK.toLocaleString("sv-SE")} kr,
              24 timmars betalningsfrist och unik bokningsreferens.
              Kontrollera betalningen i Swish själv; utebliven handpenning avbokas
              endast manuellt av Maria. Ingen automatisk betalningskontroll eller SMS.</>}
        </p>

        {value("payment_error") ? <p role="alert" className="mt-3 rounded-lg bg-[#fff0ee] p-3 text-sm font-semibold text-[#a33b2f]">{isEnglish ? "Could not update the Swish deposit. Check the payment and try again." : "Kunde inte uppdatera Swish-handpenningen. Kontrollera betalningen och försök igen."}</p> : null}
        <div className="mt-4">
          <MariaSwishPaymentControl
            bookingId={booking.id}
            bookingStatus={booking.status}
            readOk={manualSwish?.ok === true}
            entry={manualSwish?.entries[booking.id]}
            returnTo="detail"
            isEnglish={isEnglish}
          />
        </div>
        <p className="mt-2 text-sm"><strong>{isEnglish ? "Swish business:" : "Swish företag:"}</strong> {MARIA_SWISH_NUMBER}</p>
        {mariaQrEligibility === "eligible" ? (
          <Image src={mariaSwishQrPath(booking.id)} alt={isEnglish ? "Swish QR with 2,000 SEK and this booking reference" : "Swish QR med 2 000 kr och bokningsnummer för denna bokning"}
            width={380} height={380} unoptimized className="mt-4 h-auto max-w-[210px] rounded-lg border border-[#e8d9dc]" />
        ) : (
          <p className="mt-3 text-sm text-[#754b5a]">
            {isEnglish ? "The QR code is available only for an eligible confirmed or completed QA booking with a unique reference." : "QR-koden visas bara för en godkänd bekräftad eller avslutad QA-bokning med unik referens."}
          </p>
        )}
      </section>
    ) : null}


    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <article className="rounded-card border border-line bg-surface p-6 shadow-sm">
          <h3 className="text-xl font-bold text-ink">{isEnglish ? "Booking" : "Bokning"}</h3>
          <div className="mt-5 grid gap-3 rounded-control border border-line bg-surface-subtle p-4 text-sm text-ink-muted sm:grid-cols-2">
            <p><strong>Start:</strong> {booking.time}</p><p><strong>{isEnglish ? "End:" : "Slut:"}</strong> {booking.endsAt}</p>
            <p><strong>{isEnglish ? "Location:" : "Ort:"}</strong> {booking.city}</p><p><strong>{isEnglish ? "Service:" : "Tjänst:"}</strong> {booking.service}</p>
            <p><strong>{isEnglish ? "Created:" : "Skapad:"}</strong> {booking.createdAt}</p>
          </div>
        </article>

        {parsedNotes.estimatedPrice ? <article className="overflow-hidden rounded-card border border-[#d5e4f5] bg-surface shadow-sm">
          <div className="flex flex-col gap-4 bg-[#071b42] p-6 text-white sm:flex-row sm:items-end sm:justify-between">
            <div><p className="flex items-center gap-2 text-sm font-bold text-[#bcd5ff]"><CirclePoundSterling className="h-5 w-5" />{isEnglish ? "Customer price estimate" : "Kundens prisindikation"}</p><p className="mt-2 text-4xl font-black tracking-tight">{parsedNotes.estimatedPrice}</p></div>
            {parsedNotes.minimumCharge ? <div className="rounded-control bg-surface/10 px-4 py-3 text-sm"><span className="text-[#bcd5ff]">{isEnglish ? "Minimum charge" : "Minimipris"}</span><strong className="ml-2">{parsedNotes.minimumCharge}</strong></div> : null}
          </div>
          <div className="p-6">
            {parsedNotes.priceLines.length ? <div className="grid gap-2">{parsedNotes.priceLines.map((line) => <div key={line} className="flex items-start gap-3 rounded-control border border-[#e3eaf3] bg-[#f8fbff] px-4 py-3 text-sm text-[#34485f]"><ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[#2769b5]" /><span>{line}</span></div>)}</div> : null}
            {parsedNotes.priceNotice ? <p className="mt-4 rounded-control bg-[#fff8e8] p-4 text-sm leading-6 text-[#73551b]">{parsedNotes.priceNotice}</p> : null}
          </div>
        </article> : null}

        {parsedNotes.propertyRows.length ? <article className="rounded-card border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3"><ListChecks className="h-5 w-5 text-brand" /><h3 className="text-xl font-bold text-ink">{isEnglish ? "Property & job details" : "Fastighet & jobbdetaljer"}</h3></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{parsedNotes.propertyRows.map((row) => <div key={row.label.toLowerCase()} className="rounded-control border border-line bg-surface-subtle p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#718077]">{row.label}</p><p className="mt-1 font-semibold text-[#26362d]">{row.value}</p></div>)}</div>
        </article> : null}

        {parsedNotes.photoPaths.length ? <article className="rounded-card border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3"><Camera className="h-5 w-5 text-brand" /><h3 className="text-xl font-bold text-ink">{isEnglish ? "Property photos" : "Fastighetsbilder"}</h3></div>
          <p className="mt-2 text-sm text-ink-muted">{isEnglish ? "Photos supplied by the customer for access and price review." : "Bilder som kunden skickade för åtkomst- och prisbedömning."}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{parsedNotes.photoPaths.map((pathname, index) => { const src = `/api/primeview/booking-photo?bookingId=${encodeURIComponent(booking.id)}&pathname=${encodeURIComponent(pathname)}`; return <a key={pathname} href={src} target="_blank" rel="noreferrer" className="overflow-hidden rounded-control border border-line bg-surface-subtle"><Image src={src} alt={`Property photo ${index + 1}`} width={720} height={480} unoptimized className="aspect-[3/2] w-full object-cover" /></a>; })}</div>
        </article> : null}

        {parsedNotes.customerNote || parsedNotes.rawNote ? <article className="rounded-card border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-center gap-3"><StickyNote className="h-5 w-5 text-brand" /><h3 className="text-xl font-bold text-ink">{isEnglish ? "Customer notes" : "Kundnotering"}</h3></div>
          <p className="mt-4 whitespace-pre-wrap rounded-control border border-line bg-surface-subtle p-4 text-sm leading-7 text-ink-muted">{parsedNotes.customerNote || parsedNotes.rawNote}</p>
        </article> : null}

        <article className="rounded-card border border-line bg-surface p-6 shadow-sm"><h3 className="text-xl font-bold text-ink">{isEnglish ? "Change time" : "Ändra tid"}</h3><p className="mt-3 text-sm leading-7 text-ink-muted">{isEnglish ? "Select a new start time. The current duration is preserved, conflicts are blocked, and the customer receives SMS and email when contact details are available." : "Välj en ny starttid. Bokningens nuvarande längd behålls, krockar blockeras och kunden får SMS och e-post när kontaktuppgifter finns."}</p><form action={rescheduleAction} className="mt-5 grid gap-4 rounded-control border border-line bg-surface-subtle p-4"><input type="hidden" name="lang" value={locale} /><label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "New start time" : "Ny starttid"}<input name="startsAt" type="datetime-local" required className={fieldClass} /></label><button type="submit" className="inline-flex w-fit rounded-control bg-brand-deep px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep">{isEnglish ? "Reschedule booking" : "Flytta bokning"}</button></form></article>

        <article className="rounded-card border border-line bg-surface p-6 shadow-sm"><h3 className="text-xl font-bold text-ink">{isEnglish ? "Change status" : "Ändra status"}</h3><p className="mt-3 text-sm leading-7 text-ink-muted">{mariaPreview ? (isEnglish
  ? "Maria only emails the approved QA inbox: a confirmation explains the 2,000 SEK Swish deposit due within 24 hours; cancellation sends a friendly email. No SMS is sent."
  : "Maria skickar enbart mejl till godkänd testmottagare: vid bekräftelse skickas Swish-handpenning 2 000 kr inom 24 timmar, och vid manuell avbokning ett vänligt avbokningsmejl. Inga SMS skickas.") : isEnglish ? "Confirmation or cancellation sends email and SMS when the customer has provided contact details." : "Vid bekräftelse eller avbokning skickas e-post och SMS när kunden har lämnat kontaktuppgifter."}</p><form action={statusAction} className="mt-5 grid gap-4 rounded-control border border-line bg-surface-subtle p-4"><input type="hidden" name="lang" value={locale} /><label className="grid gap-2 text-sm font-semibold text-ink">{isEnglish ? "New status" : "Ny status"}<select name="status" defaultValue={bookingStatusOptions.includes(booking.status as DashboardBookingStatus) ? booking.status : "requested"} className={fieldClass}>{bookingStatusOptions.map((status) => <option key={status} value={status}>{bookingStatuses[status]}</option>)}</select></label><button type="submit" className="inline-flex w-fit rounded-control bg-brand-deep px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-deep">{isEnglish ? "Update status" : "Uppdatera status"}</button></form></article>

        {mariaPreview && booking.source === "public_booking"
          && customer?.email && isMariaPreviewTestRecipient(customer.email)
          && (booking.status === "confirmed" || booking.status === "cancelled") ? (
          <article className="rounded-card border border-line bg-surface p-6 shadow-sm">
            <h3 className="text-xl font-bold text-ink">{isEnglish ? "Resend Maria status email" : "Skicka om Marias statusmejl"}</h3>
            <p className="mt-2 text-sm text-ink-muted">
              {isEnglish
                ? "If the previous email failed, check the approved QA inbox first to avoid duplicates. This sends the current status only; it does not change the booking or extend the deposit deadline."
                : "Om förra mejlet misslyckades, kontrollera den godkända QA-inkorgen först så att du inte skickar dubbletter. Endast aktuell status skickas, utan att ändra bokningen eller förlänga betalningsfristen."}
            </p>
            <form action={resendStatusAction} className="mt-4">
              <input type="hidden" name="lang" value={locale} />
              <MariaStatusEmailRetryButton isEnglish={isEnglish} />
            </form>
          </article>
        ) : null}

        <article className="rounded-card border border-line bg-surface p-6 shadow-sm"><div className="flex items-center justify-between border-b border-line pb-4"><div><h3 className="text-xl font-bold text-ink">{isEnglish ? "Connected customer" : "Kopplad kund"}</h3><p className="text-sm text-ink-muted">{isEnglish ? "Customer details connected to the booking." : "Kunduppgifter kopplade till bokningen."}</p></div><span className="rounded-full bg-[#eaf8f2] px-3 py-1 text-xs font-semibold text-brand">{isEnglish ? "Customer data" : "Kunddata"}</span></div>{!customer ? <p className="mt-5 rounded-control border border-line bg-surface-subtle p-4 text-sm text-ink-muted">{isEnglish ? "No customer is connected to this booking." : "Ingen kund är kopplad till den här bokningen."}</p> : <div className="mt-5 rounded-control border border-line bg-surface-subtle p-4 text-sm text-ink-muted"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-lg font-bold text-ink">{customer.name}</p><p className="mt-1 text-ink-muted">{customer.type} · {customer.city}</p><p className="mt-3"><strong>Status:</strong> {customerStatuses[customer.status as keyof typeof customerStatuses] ?? customer.status}</p><p><strong>{isEnglish ? "Email:" : "E-post:"}</strong> {customer.email}</p><p><strong>{isEnglish ? "Phone:" : "Telefon:"}</strong> {customer.phone}</p></div><Link href={withLang(`/dashboard/kunder/${customer.id}`, locale)} className="inline-flex min-h-10 items-center justify-center rounded-full bg-brand-deep px-4 py-2 text-sm font-bold text-white shadow-sm">{isEnglish ? "View customer profile" : "Visa kundprofil"}</Link></div></div>}</article>
      </div>

      <aside className="rounded-card border border-line bg-surface p-6 shadow-card"><h3 className="text-xl font-bold">{isEnglish ? "Booking history" : "Bokningshistorik"}</h3><p className="mt-3 text-sm leading-7 text-ink-muted">{isEnglish ? "Status changes, rescheduling and important booking events are collected here." : "Här samlas statusändringar, ombokningar och viktiga händelser kopplade till bokningen."}</p><div className="mt-5 space-y-3">{historyEvents.map((event) => <div key={event.id} className="rounded-card border border-line bg-surface-subtle p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-deep">{eventTypes[event.type as keyof typeof eventTypes] ?? event.type}</span><span className="text-xs text-ink-muted">{event.createdAt}</span></div><p className="mt-3 font-semibold">{event.title}</p><p className="mt-2 text-sm leading-6 text-ink-muted">{event.description}</p></div>)}</div></aside>
    </section>
  </div>;
}
