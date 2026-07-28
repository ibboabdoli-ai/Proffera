import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft, CalendarClock, CircleUserRound, RefreshCw } from "lucide-react";

import { DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardBookingDetailInStockholm } from "@/lib/dashboard-booking-detail-db";
import { sendBookingStatusEmail } from "@/features/email/lead-email";
import { sendBookingRescheduleEmail } from "@/features/email/booking-reschedule-email";
import { sendBookingCustomerSms } from "@/features/sms/booking-sms";
import {
  isDashboardBookingStatus,
  updateDashboardBookingStatus,
  type DashboardBookingStatus,
} from "@/lib/dashboard-booking-status";
import {
  BookingRescheduleValidationError,
  rescheduleDashboardBooking,
} from "@/lib/dashboard-booking-reschedule";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

export const dynamic = "force-dynamic";

const bookingStatusOptions = ["requested", "confirmed", "completed", "cancelled"] as const;

type BookingDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    error?: string | string[];
    updated?: string | string[];
    rescheduled?: string | string[];
  }>;
};

const bookingStatusLabels: Record<string, string> = {
  draft: "Utkast",
  requested: "Förfrågad",
  confirmed: "Bekräftad",
  completed: "Klar",
  cancelled: "Avbokad",
  no_show: "Uteblev",
};

const customerStatusLabels: Record<string, string> = {
  prospect: "Prospekt",
  active: "Aktiv",
  paused: "Pausad",
  lost: "Förlorad",
};

const eventTypeLabels: Record<string, string> = {
  note: "Notering",
  call: "Samtal",
  email: "E-post",
  booking: "Bokning",
  booking_rescheduled: "Ombokning",
  status_change: "Statusändring",
  ai_conversation: "AI-dialog",
};

const errorMessages: Record<string, string> = {
  access: "Du saknar behörighet att ändra bokningen.",
  status: "Vald status är ogiltig.",
  save: "Ändringen kunde inte sparas. Försök igen eller kontrollera konfigurationen.",
  reschedule_time: "Välj ett giltigt datum och klockslag.",
  reschedule_past: "Den nya tiden måste ligga i framtiden.",
  reschedule_conflict: "Den nya tiden krockar med en annan aktiv bokning.",
  reschedule_status: "En avbokad eller utebliven bokning kan inte flyttas.",
};

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithError(bookingId: string, error: keyof typeof errorMessages): never {
  redirect(`/dashboard/bokningar/${bookingId}?error=${error}`);
}

async function requireBookingManager(bookingId: string) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access) || !(await hasDashboardModuleAccess("online_booking"))) {
    redirectWithError(bookingId, "access");
  }
  return access;
}

async function updateBookingStatusAction(bookingId: string, formData: FormData) {
  "use server";
  const workspaceAccess = await requireBookingManager(bookingId);
  const status = getFormText(formData, "status");
  if (!isDashboardBookingStatus(status)) redirectWithError(bookingId, "status");

  try {
    const result = await updateDashboardBookingStatus(bookingId, status);
    if (result.changed && result.notification && (status === "confirmed" || status === "cancelled")) {
      const notification = result.notification;
      await Promise.allSettled([
        notification.customerEmail
          ? sendBookingStatusEmail({
              customerName: notification.customerName,
              customerEmail: notification.customerEmail,
              companyName: workspaceAccess.workspaceName,
              status,
              service: notification.service,
              startsAt: notification.startsAt,
              endsAt: notification.endsAt,
              city: notification.city,
            })
          : Promise.resolve(null),
        notification.customerPhone
          ? sendBookingCustomerSms({
              customerPhone: notification.customerPhone,
              companyName: workspaceAccess.workspaceName,
              status,
              service: notification.service,
              startsAt: notification.startsAt,
            })
          : Promise.resolve(null),
      ]);
    }
  } catch (error) {
    console.error("Failed to update dashboard booking status", error);
    redirectWithError(bookingId, "save");
  }

  redirect(`/dashboard/bokningar/${bookingId}?updated=1`);
}

async function rescheduleBookingAction(bookingId: string, formData: FormData) {
  "use server";
  const workspaceAccess = await requireBookingManager(bookingId);
  const startsAt = getFormText(formData, "startsAt");

  try {
    const result = await rescheduleDashboardBooking(bookingId, startsAt);
    if (result.changed && result.notification) {
      const notification = result.notification;
      await Promise.allSettled([
        notification.customerEmail
          ? sendBookingRescheduleEmail({
              customerName: notification.customerName,
              customerEmail: notification.customerEmail,
              companyName: workspaceAccess.workspaceName,
              service: notification.service,
              previousStartsAt: notification.previousStartsAt,
              startsAt: notification.startsAt,
              endsAt: notification.endsAt,
              city: notification.city,
            })
          : Promise.resolve(null),
        notification.customerPhone
          ? sendBookingCustomerSms({
              customerPhone: notification.customerPhone,
              companyName: workspaceAccess.workspaceName,
              status: "rescheduled",
              service: notification.service,
              previousStartsAt: notification.previousStartsAt,
              startsAt: notification.startsAt,
            })
          : Promise.resolve(null),
      ]);
    }
  } catch (error) {
    if (error instanceof BookingRescheduleValidationError) {
      redirectWithError(bookingId, `reschedule_${error.code}` as keyof typeof errorMessages);
    }
    console.error("Failed to reschedule dashboard booking", error);
    redirectWithError(bookingId, "save");
  }

  redirect(`/dashboard/bokningar/${bookingId}?rescheduled=1`);
}

export default async function BookingDetailPage({ params, searchParams }: BookingDetailPageProps) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const detail = await getDashboardBookingDetailInStockholm(id);
  if (!detail) notFound();

  const { booking, customer, events } = detail;
  const errorValue = Array.isArray(query?.error) ? query?.error[0] : query?.error;
  const updatedValue = Array.isArray(query?.updated) ? query?.updated[0] : query?.updated;
  const rescheduledValue = Array.isArray(query?.rescheduled) ? query?.rescheduled[0] : query?.rescheduled;
  const errorMessage = errorValue ? errorMessages[errorValue] : undefined;
  const statusAction = updateBookingStatusAction.bind(null, booking.id);
  const rescheduleAction = rescheduleBookingAction.bind(null, booking.id);
  const metrics = [
    { label: "Status", value: bookingStatusLabels[booking.status] ?? booking.status, helper: "Aktuell bokningsstatus", icon: CalendarClock, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: "Kund", value: booking.customer, helper: "Kopplad kundprofil", icon: CircleUserRound, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Händelser", value: String(events.length), helper: "Registrerade aktiviteter", icon: Activity, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Åtgärd", value: "Tillgänglig", helper: "Status och tid kan uppdateras", icon: RefreshCw, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ] as const;

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Bokningsprofil"
        title={booking.title}
        description="Se bokningens viktigaste uppgifter, kopplad kund och historik. Ändra status eller flytta tiden kontrollerat."
        icon={CalendarClock}
        actions={
          <Link href="/dashboard/bokningar" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f] transition hover:-translate-y-0.5 hover:bg-[#f3f6f2]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Tillbaka till bokningar
          </Link>
        }
      />

      {errorMessage ? <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{errorMessage}</section> : null}
      {updatedValue === "1" ? <section className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">Status uppdaterades och ändringen sparades i historiken.</section> : null}
      {rescheduledValue === "1" ? <section className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">Bokningen flyttades. Den tidigare och nya tiden sparades i historiken och kunden notifierades när kontaktuppgifter fanns.</section> : null}

      <DashboardMetricGrid items={metrics} />

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-[#17201a]">Bokning</h3>
            <div className="mt-5 grid gap-3 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139] sm:grid-cols-2">
              <p><strong>Start:</strong> {booking.time}</p>
              <p><strong>Slut:</strong> {booking.endsAt}</p>
              <p><strong>Ort:</strong> {booking.city}</p>
              <p><strong>Tjänst:</strong> {booking.service}</p>
              <p><strong>Skapad:</strong> {booking.createdAt}</p>
            </div>
            <p className="mt-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-7 text-[#344139]"><strong>Notering:</strong> {booking.notes}</p>
          </article>

          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-[#17201a]">Ändra tid</h3>
            <p className="mt-3 text-sm leading-7 text-[#5b665f]">Välj en ny starttid. Bokningens nuvarande längd behålls, krockar blockeras och kunden får SMS och e-post när kontaktuppgifter finns.</p>
            <form action={rescheduleAction} className="mt-5 grid gap-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4">
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Ny starttid
                <input name="startsAt" type="datetime-local" required className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20" />
              </label>
              <button type="submit" className="inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322]">Flytta bokning</button>
            </form>
          </article>

          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-[#17201a]">Ändra status</h3>
            <p className="mt-3 text-sm leading-7 text-[#5b665f]">Vid bekräftelse eller avbokning skickas e-post och SMS när kunden har lämnat kontaktuppgifter.</p>
            <form action={statusAction} className="mt-5 grid gap-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4">
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Ny status
                <select name="status" defaultValue={bookingStatusOptions.includes(booking.status as DashboardBookingStatus) ? booking.status : "requested"} className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20">
                  {bookingStatusOptions.map((status) => <option key={status} value={status}>{bookingStatusLabels[status]}</option>)}
                </select>
              </label>
              <button type="submit" className="inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322]">Uppdatera status</button>
            </form>
          </article>

          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#dfe5dd] pb-4">
              <div><h3 className="text-xl font-bold text-[#17201a]">Kopplad kund</h3><p className="text-sm text-[#5b665f]">Kunduppgifter kopplade till bokningen.</p></div>
              <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Kunddata</span>
            </div>
            {!customer ? <p className="mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#5b665f]">Ingen kund är kopplad till den här bokningen.</p> : (
              <div className="mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-bold text-[#17201a]">{customer.name}</p>
                    <p className="mt-1 text-[#5b665f]">{customer.type} · {customer.city}</p>
                    <p className="mt-3"><strong>Status:</strong> {customerStatusLabels[customer.status] ?? customer.status}</p>
                    <p><strong>E-post:</strong> {customer.email}</p>
                    <p><strong>Telefon:</strong> {customer.phone}</p>
                  </div>
                  <Link href={`/dashboard/kunder/${customer.id}`} className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#0f3322] px-4 py-2 text-sm font-bold !text-white shadow-sm">Visa kundprofil</Link>
                </div>
              </div>
            )}
          </article>
        </div>

        <aside className="rounded-3xl bg-[#17452f] p-6 text-white">
          <h3 className="text-xl font-bold">Bokningshistorik</h3>
          <p className="mt-3 text-sm leading-7 text-white/80">Här samlas statusändringar, ombokningar och viktiga händelser kopplade till bokningen.</p>
          <div className="mt-5 space-y-3">
            {events.length === 0 ? <p className="rounded-2xl bg-white/10 p-4 text-sm text-white/80">Inga händelser hittades.</p> : events.map((event) => (
              <div key={event.id} className="rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{eventTypeLabels[event.type] ?? event.type}</span>
                  <span className="text-xs text-white/70">{event.createdAt}</span>
                </div>
                <p className="mt-3 font-semibold">{event.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/80">{event.description}</p>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
