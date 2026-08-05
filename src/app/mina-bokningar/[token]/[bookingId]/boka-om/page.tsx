import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { CalendarClock, Clock3, UserRound } from "lucide-react";

import { getRescheduleBooking, rescheduleCustomerBooking } from "@/lib/customer-booking-reschedule";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string; bookingId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

const errors: Record<string, string> = {
  time: "Välj ett giltigt datum och klockslag.",
  notice: "Tiden ligger för nära. Välj en senare tid.",
  advance: "Tiden ligger för långt fram.",
  hours: "Tiden ligger utanför bokningstiderna.",
  hours_missing: "Det finns inga publicerade arbetstider den dagen.",
  conflict: "Tiden har redan bokats. Välj en annan tid.",
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

  async function reschedule(formData: FormData) {
    "use server";
    const date = String(formData.get("date") ?? "");
    const time = String(formData.get("time") ?? "");
    const result = await rescheduleCustomerBooking(token, bookingId, `${date}T${time}`);
    if (!result.ok) redirect(`/mina-bokningar/${encodeURIComponent(token)}/${bookingId}/boka-om?error=${result.error}`);
    redirect(`/mina-bokningar/${encodeURIComponent(token)}?changed=1`);
  }

  return (
    <main className="min-h-screen bg-[#f4f7f3] px-4 py-8 sm:px-6">
      <section className="mx-auto max-w-xl rounded-[28px] border border-[#dfe6df] bg-white p-6 shadow-sm sm:p-8">
        <Link href={`/mina-bokningar/${encodeURIComponent(token)}`} className="text-sm font-bold text-[#17452f]">← Till mina bokningar</Link>
        <div className="mt-6 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf5ef] text-[#17452f]"><CalendarClock className="h-6 w-6" /></span>
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#647269]">Boka om</p><h1 className="text-2xl font-bold text-[#17201a]">{booking.service}</h1></div>
        </div>

        <div className="mt-6 rounded-2xl bg-[#f4f7f3] p-4 text-sm text-[#344139]">
          <p className="flex items-center gap-2"><Clock3 className="h-4 w-4" />Nuvarande tid: <strong>{formatDate(booking.startsAt, booking.timeZone)}</strong></p>
          {booking.staffName ? <p className="mt-2 flex items-center gap-2"><UserRound className="h-4 w-4" />Medarbetare: <strong>{booking.staffName}</strong></p> : null}
        </div>

        {query?.error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff4f2] p-4 text-sm font-bold text-[#a5362a]">{errors[query.error] ?? "Tiden kunde inte ändras."}</p> : null}

        <form action={reschedule} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-bold text-[#344139]">Nytt datum
            <input name="date" type="date" required min={new Date().toISOString().slice(0, 10)} className="min-h-12 rounded-xl border border-[#cfd9d0] px-4 py-3 text-base" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#344139]">Ny tid
            <input name="time" type="time" required step={900} className="min-h-12 rounded-xl border border-[#cfd9d0] px-4 py-3 text-base" />
          </label>
          <p className="text-xs leading-5 text-[#667168]">Systemet kontrollerar arbetstid, medarbetarens frånvaro och andra bokningar innan ändringen sparas. En bekräftad bokning blir en ny bokningsförfrågan efter tidsändringen.</p>
          <button className="min-h-12 rounded-xl bg-[#17452f] px-5 py-3 font-bold text-white hover:bg-[#123824]">Spara ny tid</button>
        </form>
      </section>
    </main>
  );
}
