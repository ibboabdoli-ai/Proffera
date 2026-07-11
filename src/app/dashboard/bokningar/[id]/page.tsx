import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft, CalendarClock, CircleUserRound, RefreshCw } from "lucide-react";

import { DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardBookingDetail } from "@/lib/dashboard-db";
import {
  isDashboardBookingStatus,
  updateDashboardBookingStatus,
  type DashboardBookingStatus,
} from "@/lib/dashboard-booking-status";

export const dynamic = "force-dynamic";

const bookingStatusOptions = ["requested", "confirmed", "completed", "cancelled"] as const;

type BookingDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    error?: string | string[];
    updated?: string | string[];
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
  status_change: "Statusändring",
  ai_conversation: "AI-dialog",
};

const errorMessages: Record<string, string> = {
  access: "Åtkomstkoden saknas eller är fel. Status ändrades inte.",
  disabled: "Statusändring är inte aktiverad just nu.",
  status: "Vald status är ogiltig.",
  save: "Status kunde inte uppdateras. Försök igen eller kontrollera konfigurationen.",
};

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithStatusError(bookingId: string, error: keyof typeof errorMessages): never {
  redirect(`/dashboard/bokningar/${bookingId}?error=${error}`);
}

async function updateBookingStatusAction(bookingId: string, formData: FormData) {
  "use server";

  const expectedCode = (process.env.DASHBOARD_WRITE_CODE ?? process.env.ADMIN_ACCESS_CODE ?? "").trim();

  if (!expectedCode) {
    redirectWithStatusError(bookingId, "disabled");
  }

  const accessCode = getFormText(formData, "access_code");

  if (accessCode !== expectedCode) {
    redirectWithStatusError(bookingId, "access");
  }

  const status = getFormText(formData, "status");

  if (!isDashboardBookingStatus(status)) {
    redirectWithStatusError(bookingId, "status");
  }

  try {
    await updateDashboardBookingStatus(bookingId, status);
  } catch (error) {
    console.error("Failed to update dashboard booking status", error);
    redirectWithStatusError(bookingId, "save");
  }

  redirect(`/dashboard/bokningar/${bookingId}?updated=1`);
}

export default async function BookingDetailPage({ params, searchParams }: BookingDetailPageProps) {
  const [{ id }, query] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const detail = await getDashboardBookingDetail(id);

  if (!detail) {
    notFound();
  }

  const { booking, customer, events } = detail;
  const errorValue = Array.isArray(query?.error) ? query?.error[0] : query?.error;
  const updatedValue = Array.isArray(query?.updated) ? query?.updated[0] : query?.updated;
  const errorMessage = errorValue ? errorMessages[errorValue] : undefined;
  const statusAction = updateBookingStatusAction.bind(null, booking.id);
  const metrics = [
    { label: "Status", value: bookingStatusLabels[booking.status] ?? booking.status, helper: "Aktuell bokningsstatus", icon: CalendarClock, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: "Kund", value: booking.customer, helper: "Kopplad kundprofil", icon: CircleUserRound, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Händelser", value: String(events.length), helper: "Registrerade aktiviteter", icon: Activity, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Åtgärd", value: "Tillgänglig", helper: "Status kan uppdateras", icon: RefreshCw, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ] as const;

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Bokningsprofil"
        title={booking.title}
        description="Se bokningens viktigaste uppgifter, kopplad kund och historik. Status kan ändras kontrollerat med intern åtkomstkod."
        icon={CalendarClock}
        actions={
          <Link href="/dashboard/bokningar" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f] transition hover:-translate-y-0.5 hover:bg-[#f3f6f2]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Tillbaka till bokningar
          </Link>
        }
      />

      {errorMessage ? (
        <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {errorMessage}
        </section>
      ) : null}

      {updatedValue === "1" ? (
        <section className="rounded-2xl bg-[#eef8f1] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">
          Status uppdaterades. Händelsen sparas i bokningshistoriken och ingen e-post skickas.
        </section>
      ) : null}

      <DashboardMetricGrid items={metrics} />

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
            <h3 className="text-xl font-bold text-[#17201a]">Bokning</h3>
            <div className="mt-5 grid gap-3 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139] sm:grid-cols-2">
              <p>
                <strong>Start:</strong> {booking.time}
              </p>
              <p>
                <strong>Slut:</strong> {booking.endsAt}
              </p>
              <p>
                <strong>Ort:</strong> {booking.city}
              </p>
              <p>
                <strong>Tjänst:</strong> {booking.service}
              </p>
              <p>
                <strong>Skapad:</strong> {booking.createdAt}
              </p>
            </div>
            <p className="mt-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-7 text-[#344139]">
              <strong>Notering:</strong> {booking.notes}
            </p>
          </article>

          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
            <h3 className="text-xl font-bold text-[#17201a]">Ändra status</h3>
            <p className="mt-3 text-sm leading-7 text-[#5b665f]">
              Ändra bokningens status när tiden är bekräftad, utförd eller behöver avbokas. En statusändring sparas i historiken och ingen e-post skickas automatiskt.
            </p>
            <form action={statusAction} className="mt-5 grid gap-4 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4">
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Intern åtkomstkod
                <input
                  name="access_code"
                  type="password"
                  required
                  autoComplete="off"
                  className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
                  placeholder="Ange intern kod"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#17201a]">
                Ny status
                <select
                  name="status"
                  defaultValue={bookingStatusOptions.includes(booking.status as DashboardBookingStatus) ? booking.status : "requested"}
                  className="rounded-xl border border-[#d9e1d7] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20"
                >
                  {bookingStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {bookingStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex w-fit rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
              >
                Uppdatera status
              </button>
            </form>
          </article>

          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
            <div className="flex items-center justify-between border-b border-[#dfe5dd] pb-4">
              <div>
                <h3 className="text-xl font-bold text-[#17201a]">Kopplad kund</h3>
                <p className="text-sm text-[#5b665f]">Kunduppgifter kopplade till bokningen.</p>
              </div>
              <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Kunddata</span>
            </div>
            {!customer ? (
              <p className="mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#5b665f]">
                Ingen kund är kopplad till den här bokningen.
              </p>
            ) : (
              <div className="mt-5 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm text-[#344139]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-bold text-[#17201a]">{customer.name}</p>
                    <p className="mt-1 text-[#5b665f]">
                      {customer.type} · {customer.city}
                    </p>
                    <p className="mt-3">
                      <strong>Status:</strong> {customerStatusLabels[customer.status] ?? customer.status}
                    </p>
                    <p>
                      <strong>E-post:</strong> {customer.email}
                    </p>
                    <p>
                      <strong>Telefon:</strong> {customer.phone}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/kunder/${customer.id}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#0f3322] px-4 py-2 text-sm font-bold !text-white shadow-sm ring-1 ring-[#0f3322]/20 transition hover:bg-[#17452f] hover:!text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
                  >
                    Visa kundprofil
                  </Link>
                </div>
              </div>
            )}
          </article>
        </div>

        <aside className="rounded-3xl bg-[#17452f] p-6 text-white">
          <h3 className="text-xl font-bold">Bokningshistorik</h3>
          <p className="mt-3 text-sm leading-7 text-white/80">
            Här samlas statusändringar, noteringar och viktiga händelser kopplade till bokningen.
          </p>
          <div className="mt-5 space-y-3">
            {events.length === 0 ? (
              <p className="rounded-2xl bg-white/10 p-4 text-sm text-white/80">Inga händelser hittades.</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="rounded-2xl bg-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                      {eventTypeLabels[event.type] ?? event.type}
                    </span>
                    <span className="text-xs text-white/70">{event.createdAt}</span>
                  </div>
                  <p className="mt-3 font-semibold">{event.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/80">{event.description}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
