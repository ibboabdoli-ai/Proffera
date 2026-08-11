/* eslint-disable react-hooks/purity */
import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, CalendarDays, Clock3, History, MapPin, XCircle } from "lucide-react";

import { cancelCustomerCalendarBooking, getCustomerCalendar, type CustomerCalendarBooking } from "@/lib/customer-calendar";
import { getCustomerPortalLanguage } from "@/lib/customer-portal-language";
import { isPrimeViewHost } from "@/lib/public-site-domains";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ changed?: string; cancelled?: string; error?: string }>;
};

const statusLabelsSv: Record<string, string> = {
  draft: "Utkast",
  requested: "Förfrågad",
  confirmed: "Bekräftad",
  completed: "Genomförd",
  cancelled: "Avbokad",
  no_show: "Uteblev",
};

const statusLabelsEn: Record<string, string> = {
  draft: "Draft",
  requested: "Requested",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

const formatDate = (value: string, timeZone: WorkspaceTimeZone, isEnglish: boolean) =>
  new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

async function cancelBooking(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const id = String(formData.get("booking_id") ?? "");
  const result = await cancelCustomerCalendarBooking(token, id);
  if (result.ok) revalidatePath(`/mina-bokningar/${token}`);
}

function BookingCard({
  booking,
  token,
  timeZone,
  canReschedule,
  canCancel,
  cancelNoticeHours,
  isEnglish,
}: {
  booking: CustomerCalendarBooking;
  token: string;
  timeZone: WorkspaceTimeZone;
  canReschedule: boolean;
  canCancel: boolean;
  cancelNoticeHours: number;
  isEnglish: boolean;
}) {
  const calendarUrl = `/api/mina-bokningar/${encodeURIComponent(token)}/${encodeURIComponent(booking.id)}/calendar`;
  const start = new Date(booking.startsAt).getTime();
  const isPast = start <= Date.now();
  const active = ["requested", "confirmed"].includes(booking.status) && !isPast;
  const rescheduleAllowed = active && canReschedule;
  const cancelAllowed = active && canCancel && start > Date.now() + cancelNoticeHours * 3_600_000;
  const labels = isEnglish ? statusLabelsEn : statusLabelsSv;
  const displayStatus = isPast && ["requested", "confirmed"].includes(booking.status)
    ? isEnglish ? "Time has passed" : "Tiden har passerat"
    : labels[booking.status] ?? booking.status;

  const accent = isEnglish ? "text-[#1769c2]" : "text-[#17452f]";
  const button = isEnglish
    ? "border-[#b9cdec] text-[#0a3c8f] hover:bg-[#f2f7ff]"
    : "border-[#cfd9d0] text-[#17452f]";

  return (
    <article className={`rounded-2xl border bg-white p-5 shadow-sm ${isEnglish ? "border-[#d9e4ef]" : "border-[#dfe6df]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.16em] ${isEnglish ? "text-[#5f7894]" : "text-[#647269]"}`}>{displayStatus}</p>
          <h3 className={`mt-1 text-lg font-black ${isEnglish ? "text-[#071b42]" : "text-[#17201a]"}`}>{booking.title}</h3>
          <p className={`mt-1 text-sm ${isEnglish ? "text-[#667b91]" : "text-[#5c685f]"}`}>{booking.service}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${isEnglish ? "bg-[#eaf3ff] text-[#0a3c8f]" : "bg-[#edf5ef] text-[#17452f]"}`}>
          {isEnglish ? "Private booking" : "Privat bokning"}
        </span>
      </div>

      <div className={`mt-4 grid gap-2 text-sm ${isEnglish ? "text-[#334d68]" : "text-[#344139]"}`}>
        <p className="flex items-center gap-2"><Clock3 className={`h-4 w-4 ${accent}`} />{formatDate(booking.startsAt, timeZone, isEnglish)}</p>
        {booking.city ? <p className="flex items-center gap-2"><MapPin className={`h-4 w-4 ${accent}`} />{booking.city}</p> : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={calendarUrl} className={`inline-flex min-h-10 items-center rounded-xl border px-4 py-2 text-sm font-bold ${button}`}>
          {isEnglish ? "Add to calendar" : "Lägg till i kalender"}
        </Link>
        {rescheduleAllowed ? (
          <Link href={`/mina-bokningar/${encodeURIComponent(token)}/${booking.id}/boka-om`} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold ${button}`}>
            <CalendarClock className="h-4 w-4" />{isEnglish ? "Reschedule" : "Boka om"}
          </Link>
        ) : null}
        {cancelAllowed ? (
          <form action={cancelBooking}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="booking_id" value={booking.id} />
            <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#efc8c3] px-4 py-2 text-sm font-bold text-[#a5362a] hover:bg-[#fff7f5]">
              <XCircle className="h-4 w-4" />{isEnglish ? "Cancel" : "Avboka"}
            </button>
          </form>
        ) : null}
      </div>

      {active && !rescheduleAllowed && !cancelAllowed ? (
        <p className="mt-3 text-xs text-[#6c756f]">{isEnglish ? "The company has disabled self-service for this booking." : "Företaget har stängt av självservice för den här bokningen."}</p>
      ) : null}
      {active && canCancel && !cancelAllowed ? (
        <p className="mt-3 text-xs text-[#6c756f]">{isEnglish ? `Online cancellation closes ${cancelNoticeHours} hours before the appointment.` : `Avbokning online stänger ${cancelNoticeHours} timmar före start.`}</p>
      ) : null}
      {isPast && ["requested", "confirmed"].includes(booking.status) ? (
        <p className="mt-3 text-xs text-[#6c756f]">{isEnglish ? "The booking time has passed. The company can mark it as completed or no-show." : "Bokningstiden har passerat. Företaget kan markera den som genomförd eller utebliven."}</p>
      ) : null}
    </article>
  );
}

export default async function Page({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = searchParams ? await searchParams : undefined;
  const language = await getCustomerPortalLanguage(token);
  const isEnglish = language === "en";
  const requestHeaders = await headers();

  if (isEnglish && !isPrimeViewHost(requestHeaders.get("host"))) {
    const url = new URL(`https://www.primeviewwindowcare.co.uk/mina-bokningar/${encodeURIComponent(token)}`);
    if (query?.changed) url.searchParams.set("changed", query.changed);
    if (query?.cancelled) url.searchParams.set("cancelled", query.cancelled);
    if (query?.error) url.searchParams.set("error", query.error);
    redirect(url.toString());
  }

  const data = await getCustomerCalendar(token);
  if (!data) notFound();

  const card = (booking: CustomerCalendarBooking) => (
    <BookingCard
      key={booking.id}
      booking={booking}
      token={token}
      timeZone={data.timeZone}
      canReschedule={data.policy.customerRescheduleEnabled}
      canCancel={data.policy.customerCancelEnabled}
      cancelNoticeHours={data.policy.cancelNoticeHours}
      isEnglish={isEnglish}
    />
  );

  return (
    <main className={`min-h-screen px-4 py-8 sm:px-6 ${isEnglish ? "bg-[#f4f6fb]" : "bg-[#f4f7f3]"}`}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <header className={`rounded-[28px] p-6 text-white shadow-sm sm:p-8 ${isEnglish ? "bg-[#06183b]" : "bg-[#173e2b]"}`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isEnglish ? (
                <Image src="/brand/primeview-window-care-logo.jpeg" alt="PrimeView Window Care" width={56} height={56} className="h-12 w-12 rounded-xl object-cover ring-1 ring-white/25" />
              ) : (
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12"><CalendarDays className="h-5 w-5" /></span>
              )}
              <div>
                <p className={`text-xs font-bold uppercase tracking-[0.18em] ${isEnglish ? "text-[#b8ceff]" : "text-white/70"}`}>
                  {isEnglish ? "PrimeView Window Care · My bookings" : "Mina bokningar"}
                </p>
                <h1 className="mt-1 text-2xl font-black sm:text-3xl">{isEnglish ? "Hello" : "Hej"} {data.customer.name}</h1>
              </div>
            </div>
            {isEnglish ? <Link href="/" className="rounded-xl bg-[#1769c2] px-4 py-3 text-sm font-black text-white hover:bg-[#2f80ed]">PrimeView website</Link> : null}
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80">
            {isEnglish ? "Only your own bookings are shown here. Available actions are controlled by PrimeView's booking rules." : "Här visas endast dina egna bokningar. Tillgängliga åtgärder styrs av företagets bokningsregler."}
          </p>
        </header>

        {query?.changed === "1" ? (
          <p className={`rounded-xl p-4 text-sm font-bold ${isEnglish ? "bg-[#eaf3ff] text-[#0a3c8f]" : "bg-[#eaf6ed] text-[#17452f]"}`}>
            {isEnglish ? "The appointment time has been changed." : "Tiden har ändrats."}
          </p>
        ) : null}

        <section className={`rounded-[24px] border bg-white p-5 sm:p-6 ${isEnglish ? "border-[#d9e4ef]" : "border-[#dfe6df]"}`}>
          <div className="flex items-center gap-2">
            <CalendarDays className={`h-5 w-5 ${isEnglish ? "text-[#1769c2]" : "text-[#17452f]"}`} />
            <h2 className={`text-xl font-black ${isEnglish ? "text-[#071b42]" : "text-[#17201a]"}`}>{isEnglish ? "Upcoming" : "Kommande"}</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {data.upcoming.length ? data.upcoming.map(card) : <p className="text-sm text-[#667b91]">{isEnglish ? "You have no upcoming bookings." : "Du har inga kommande bokningar."}</p>}
          </div>
        </section>

        <section className={`rounded-[24px] border bg-white p-5 sm:p-6 ${isEnglish ? "border-[#d9e4ef]" : "border-[#dfe6df]"}`}>
          <div className="flex items-center gap-2">
            <History className={`h-5 w-5 ${isEnglish ? "text-[#1769c2]" : "text-[#17452f]"}`} />
            <h2 className={`text-xl font-black ${isEnglish ? "text-[#071b42]" : "text-[#17201a]"}`}>{isEnglish ? "History" : "Historik"}</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {data.history.length ? data.history.map(card) : <p className="text-sm text-[#667b91]">{isEnglish ? "No booking history yet." : "Ingen bokningshistorik ännu."}</p>}
          </div>
        </section>

        {isEnglish ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3 text-xs text-[#667b91]">
            <span>PrimeView Window Care</span>
            <Link href="/privacy" className="font-bold text-[#0a3c8f] underline underline-offset-3">Privacy Policy</Link>
          </footer>
        ) : null}
      </div>
    </main>
  );
}
