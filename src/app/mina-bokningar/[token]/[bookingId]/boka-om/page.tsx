import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { CalendarClock, Clock3, UserRound } from "lucide-react";

import { getRescheduleBooking, rescheduleCustomerBooking } from "@/lib/customer-booking-reschedule";
import { getAvailableRescheduleSlots, getUpcomingRescheduleDays } from "@/lib/customer-reschedule-slots";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string; bookingId: string }>;
  searchParams?: Promise<{ error?: string; date?: string }>;
};

const errors: Record<string, string> = {
  time: "Välj en giltig ledig tid.",
  notice: "Tiden ligger för nära. Välj en senare tid.",
  advance: "Tiden ligger för långt fram.",
  hours: "Tiden ligger utanför bokningstiderna.",
  hours_missing: "Det finns inga publicerade arbetstider den dagen.",
  conflict: "Tiden hann bokas av någon annan. Välj en ny tid.",
  time_off: "Medarbetaren är inte tillgänglig den tiden.",
  not_allowed: "Bokningen kan inte längre ändras.",
};

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

export default async function ReschedulePage({ params, searchParams }: PageProps) {
  const { token, bookingId } = await params;
  const query = searchParams ? await searchParams : undefined;
  const booking = await getRescheduleBooking(token, bookingId);
  if (!booking) notFound();

  const days = getUpcomingRescheduleDays(booking.timeZone, 7);
  const requestedDate = query?.date && days.some((day) => day.date === query.date) ? query.date : days[0]?.date;
  const slots = requestedDate ? await getAvailableRescheduleSlots(token, bookingId, requestedDate) : [];
  const selectedDay = days.find((day) => day.date === requestedDate);

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

  return (
    <main className="min-h-screen bg-[#f4f7f3] px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-2xl rounded-[28px] border border-[#dfe6df] bg-white p-6 shadow-sm sm:p-8">
        <Link href={`/mina-bokningar/${encodeURIComponent(token)}`} className="text-sm font-bold text-[#17452f]">← Till mina bokningar</Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf5ef] text-[#17452f]"><CalendarClock className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#647269]">Boka om</p>
            <h1 className="text-2xl font-bold text-[#17201a]">{booking.service}</h1>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-[#f4f7f3] p-4 text-sm text-[#344139]">
          <p className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Nuvarande tid: <strong>{formatDate(booking.startsAt, booking.timeZone)}</strong></p>
          {booking.staffName ? <p className="mt-2 flex items-center gap-2"><UserRound className="h-4 w-4" />Medarbetare: <strong>{booking.staffName}</strong></p> : null}
        </div>

        {query?.error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff4f2] p-4 text-sm font-bold text-[#a5362a]">{errors[query.error] ?? "Tiden kunde inte ändras."}</p> : null}

        <div className="mt-7">
          <h2 className="text-lg font-bold text-[#17201a]">Välj dag</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {days.map((day) => {
              const active = day.date === requestedDate;
              return (
                <Link
                  key={day.date}
                  href={`/mina-bokningar/${encodeURIComponent(token)}/${bookingId}/boka-om?date=${encodeURIComponent(day.date)}`}
                  className={`rounded-xl border px-3 py-3 text-center text-sm font-bold transition ${active ? "border-[#17452f] bg-[#17452f] text-white" : "border-[#cfd9d0] bg-white text-[#344139] hover:border-[#17452f]"}`}
                >
                  {day.shortLabel}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#17201a]">Lediga tider</h2>
              {selectedDay ? <p className="mt-1 text-sm text-[#667168]">{selectedDay.label}</p> : null}
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#647269]">Endast bokningsbara tider</span>
          </div>

          {slots.length > 0 ? (
            <form action={reschedule} className="mt-4">
              <fieldset>
                <legend className="sr-only">Välj en ledig tid</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {slots.map((slot) => (
                    <label key={slot.startsAtLocal} className="cursor-pointer">
                      <input className="peer sr-only" type="radio" name="startsAtLocal" value={slot.startsAtLocal} required />
                      <span className="grid min-h-14 place-items-center rounded-xl border border-[#b9ccc0] bg-[#f3f8f4] px-4 py-3 text-base font-bold text-[#17452f] transition peer-checked:border-[#17452f] peer-checked:bg-[#17452f] peer-checked:text-white hover:border-[#17452f]">
                        {slot.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <p className="mt-5 text-xs leading-5 text-[#667168]">Tiderna är redan kontrollerade mot arbetstid, medarbetarens frånvaro, andra bokningar och tillfälligt reserverade tider. Tillgängligheten kontrolleras igen när du sparar.</p>
              <button className="mt-5 min-h-12 w-full rounded-xl bg-[#17452f] px-5 py-3 font-bold text-white hover:bg-[#123824]">Spara vald tid</button>
            </form>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[#cfd9d0] bg-[#f8faf8] p-6 text-center">
              <p className="font-bold text-[#344139]">Inga lediga tider den här dagen.</p>
              <p className="mt-1 text-sm text-[#667168]">Välj en annan dag ovan.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
