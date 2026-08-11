import Link from "next/link";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { CalendarClock, Clock3, UserRound } from "lucide-react";

import { getRescheduleBooking, rescheduleCustomerBooking } from "@/lib/customer-booking-reschedule";
import { getCustomerPortalLanguage } from "@/lib/customer-portal-language";
import { getAvailableRescheduleSlots, getUpcomingRescheduleDays } from "@/lib/customer-reschedule-slots";
import { isPrimeViewHost } from "@/lib/public-site-domains";
import { RescheduleSlotPicker } from "./reschedule-slot-picker";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string; bookingId: string }>;
  searchParams?: Promise<{ error?: string; date?: string }>;
};

const errorsSv: Record<string, string> = {
  time: "Välj en giltig ledig tid.",
  notice: "Tiden ligger för nära. Välj en senare tid.",
  advance: "Tiden ligger för långt fram.",
  hours: "Tiden ligger utanför bokningstiderna.",
  hours_missing: "Det finns inga publicerade arbetstider den dagen.",
  conflict: "Tiden hann bokas av någon annan. Välj en ny tid.",
  time_off: "Medarbetaren är inte tillgänglig den tiden.",
  not_allowed: "Bokningen kan inte längre ändras.",
};

const errorsEn: Record<string, string> = {
  time: "Choose a valid available time.",
  notice: "That time is too soon. Choose a later time.",
  advance: "That time is too far in advance.",
  hours: "That time is outside the booking hours.",
  hours_missing: "There are no published working hours for that day.",
  conflict: "Someone else has just booked that time. Choose another time.",
  time_off: "The staff member is not available at that time.",
  not_allowed: "This booking can no longer be changed.",
};

function formatDate(value: string, timeZone: string, isEnglish: boolean) {
  return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", { timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

function formatDay(date: string, timeZone: string, isEnglish: boolean, short: boolean) {
  if (!isEnglish) return null;
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-GB", short
    ? { timeZone, weekday: "short", day: "numeric" }
    : { timeZone, weekday: "long", day: "numeric", month: "long" }
  ).format(value);
}

export default async function ReschedulePage({ params, searchParams }: PageProps) {
  const { token, bookingId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const language = await getCustomerPortalLanguage(token);
  const isEnglish = language === "en";
  const requestHeaders = await headers();
  if (isEnglish && !isPrimeViewHost(requestHeaders.get("host"))) {
    const url = new URL(`https://www.primeviewwindowcare.co.uk/mina-bokningar/${encodeURIComponent(token)}/${encodeURIComponent(bookingId)}/boka-om`);
    if (query?.date) url.searchParams.set("date", query.date);
    if (query?.error) url.searchParams.set("error", query.error);
    redirect(url.toString());
  }

  const booking = await getRescheduleBooking(token, bookingId);
  if (!booking) notFound();

  const days = getUpcomingRescheduleDays(booking.timeZone, 7);
  const slotEntries = await Promise.all(
    days.map(async (day) => [day.date, await getAvailableRescheduleSlots(token, bookingId, day.date)] as const),
  );
  const slotsByDate = new Map(slotEntries);
  const firstAvailableDate = days.find((day) => (slotsByDate.get(day.date)?.length ?? 0) > 0)?.date;
  const requestedDate = query?.date && (slotsByDate.get(query.date)?.length ?? 0) > 0
    ? query.date
    : firstAvailableDate ?? days[0]?.date;
  const slots = requestedDate ? slotsByDate.get(requestedDate) ?? [] : [];
  const selectedDay = days.find((day) => day.date === requestedDate);
  const selectedDayLabel = selectedDay ? (formatDay(selectedDay.date, booking.timeZone, isEnglish, false) ?? selectedDay.label) : undefined;

  async function reschedule(formData: FormData) {
    "use server";
    const startsAtLocal = String(formData.get("startsAtLocal") ?? "");
    const result = await rescheduleCustomerBooking(token, bookingId, startsAtLocal);
    if (!result.ok) {
      const date = startsAtLocal.slice(0, 10);
      redirect(`/mina-bokningar/${encodeURIComponent(token)}/${bookingId}/boka-om?date=${encodeURIComponent(date)}&error=${result.error}`);
    }
    redirect(`/mina-bokningar/${encodeURIComponent(token)}?changed=1`);
  }

  const errors = isEnglish ? errorsEn : errorsSv;

  return (
    <main className="min-h-screen bg-[#f4f7f3] px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-[28px] border border-[#dfe6df] bg-white p-6 shadow-sm sm:p-8">
        <Link href={`/mina-bokningar/${encodeURIComponent(token)}`} className="text-sm font-bold text-[#17452f]">← {isEnglish ? "Back to my bookings" : "Till mina bokningar"}</Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf5ef] text-[#17452f]"><CalendarClock className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#647269]">{isEnglish ? "Reschedule" : "Boka om"}</p>
            <h1 className="text-2xl font-bold text-[#17201a]">{booking.service}</h1>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-[#f4f7f3] p-4 text-sm text-[#344139]">
          <p className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{isEnglish ? "Current time" : "Nuvarande tid"}: <strong>{formatDate(booking.startsAt, booking.timeZone, isEnglish)}</strong></p>
          {booking.staffName ? <p className="mt-2 flex items-center gap-2"><UserRound className="h-4 w-4" />{isEnglish ? "Staff member" : "Medarbetare"}: <strong>{booking.staffName}</strong></p> : null}
        </div>

        {query?.error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff4f2] p-4 text-sm font-bold text-[#a5362a]">{errors[query.error] ?? (isEnglish ? "The appointment could not be changed." : "Tiden kunde inte ändras.")}</p> : null}

        <div className="mt-7">
          <h2 className="text-lg font-bold text-[#17201a]">{isEnglish ? "Choose a day" : "Välj dag"}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {days.map((day) => {
              const active = day.date === requestedDate;
              const availableCount = slotsByDate.get(day.date)?.length ?? 0;
              const shortLabel = formatDay(day.date, booking.timeZone, isEnglish, true) ?? day.shortLabel;
              if (availableCount === 0) {
                return (
                  <span key={day.date} aria-disabled="true" className="cursor-not-allowed rounded-xl border border-[#e0e5e1] bg-[#f3f5f3] px-3 py-3 text-center text-sm font-bold text-[#a1aaa4]">
                    {shortLabel}
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide">{isEnglish ? "Fully booked" : "Fullbokad"}</span>
                  </span>
                );
              }
              return (
                <Link
                  key={day.date}
                  href={`/mina-bokningar/${encodeURIComponent(token)}/${bookingId}/boka-om?date=${encodeURIComponent(day.date)}`}
                  className={`rounded-xl border px-3 py-3 text-center text-sm font-bold transition ${active ? "border-[#17452f] bg-[#17452f] text-white" : "border-[#cfd9d0] bg-white text-[#344139] hover:border-[#17452f]"}`}
                >
                  {shortLabel}
                  <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-wide ${active ? "text-white/75" : "text-[#647269]"}`}>{availableCount} {isEnglish ? (availableCount === 1 ? "time" : "times") : "tider"}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#17201a]">{isEnglish ? "Available times" : "Lediga tider"}</h2>
              {selectedDayLabel ? <p className="mt-1 text-sm text-[#667168]">{selectedDayLabel}</p> : null}
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#647269]">{isEnglish ? "Bookable times only" : "Endast bokningsbara tider"}</span>
          </div>

          {slots.length > 0 ? (
            <RescheduleSlotPicker action={reschedule} slots={slots} selectedDayLabel={selectedDayLabel} language={language} />
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[#cfd9d0] bg-[#f8faf8] p-6 text-center">
              <p className="font-bold text-[#344139]">{isEnglish ? "No available times during the next seven days." : "Inga lediga tider under de kommande sju dagarna."}</p>
              <p className="mt-1 text-sm text-[#667168]">{isEnglish ? "Contact the company if you need help finding another time." : "Kontakta företaget om du behöver hjälp med en ny tid."}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
