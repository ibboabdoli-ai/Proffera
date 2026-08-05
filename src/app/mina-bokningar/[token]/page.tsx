import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { CalendarClock, CalendarDays, Clock3, History, MapPin, XCircle } from "lucide-react";

import {
  cancelCustomerCalendarBooking,
  getCustomerCalendar,
  type CustomerCalendarBooking,
} from "@/lib/customer-calendar";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }>; searchParams?: Promise<{ changed?: string }> };

const statusLabels: Record<string, string> = {
  draft: "Utkast", requested: "Förfrågad", confirmed: "Bekräftad", completed: "Genomförd", cancelled: "Avbokad", no_show: "Uteblev",
};

function formatDate(value: string, timeZone: WorkspaceTimeZone) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

async function cancelBooking(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const bookingId = String(formData.get("booking_id") ?? "");
  const result = await cancelCustomerCalendarBooking(token, bookingId);
  if (result.ok) revalidatePath(`/mina-bokningar/${token}`);
}

function BookingCard({ booking, token, timeZone }: { booking: CustomerCalendarBooking; token: string; timeZone: WorkspaceTimeZone }) {
  const calendarUrl = `/api/mina-bokningar/${encodeURIComponent(token)}/${encodeURIComponent(booking.id)}/calendar`;
  const isPast = new Date(booking.startsAt).getTime() <= Date.now();
  const canManage = ["requested", "confirmed"].includes(booking.status) && !isPast;
  const displayStatus = isPast && ["requested", "confirmed"].includes(booking.status)
    ? "Tiden har passerat"
    : statusLabels[booking.status] ?? booking.status;

  return (
    <article className="rounded-2xl border border-[#dfe6df] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#647269]">{displayStatus}</p><h3 className="mt-1 text-lg font-bold text-[#17201a]">{booking.title}</h3><p className="mt-1 text-sm text-[#5c685f]">{booking.service}</p></div><span className="rounded-full bg-[#edf5ef] px-3 py-1 text-xs font-bold text-[#17452f]">Privat bokning</span></div>
      <div className="mt-4 grid gap-2 text-sm text-[#344139]"><p className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{formatDate(booking.startsAt, timeZone)}</p>{booking.city ? <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{booking.city}</p> : null}</div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={calendarUrl} className="inline-flex min-h-10 items-center rounded-xl border border-[#cfd9d0] px-4 py-2 text-sm font-bold text-[#17452f] hover:bg-[#f3f7f3]">Lägg till i kalender</Link>
        {canManage ? <Link href={`/mina-bokningar/${encodeURIComponent(token)}/${booking.id}/boka-om`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#b8d3c0] px-4 py-2 text-sm font-bold text-[#17452f] hover:bg-[#f3f7f3]"><CalendarClock className="h-4 w-4" />Boka om</Link> : null}
        {canManage ? <form action={cancelBooking}><input type="hidden" name="token" value={token} /><input type="hidden" name="booking_id" value={booking.id} /><button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#efc8c3] px-4 py-2 text-sm font-bold text-[#a5362a] hover:bg-[#fff4f2]"><XCircle className="h-4 w-4" />Avboka</button></form> : null}
      </div>
      {canManage ? <p className="mt-3 text-xs leading-5 text-[#6c756f]">Du kan boka om eller avboka tiden utan att skapa ett konto.</p> : null}
      {isPast && ["requested", "confirmed"].includes(booking.status) ? <p className="mt-3 text-xs leading-5 text-[#6c756f]">Bokningstiden har passerat. Företaget kan senare markera den som genomförd eller utebliven.</p> : null}
    </article>
  );
}

export default async function CustomerCalendarPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = searchParams ? await searchParams : undefined;
  const data = await getCustomerCalendar(token);
  if (!data) notFound();
  return (
    <main className="min-h-screen bg-[#f4f7f3] px-4 py-8 sm:px-6"><div className="mx-auto grid max-w-4xl gap-6">
      <header className="rounded-[28px] bg-[#173e2b] p-6 text-white shadow-sm sm:p-8"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12"><CalendarDays className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">Mina bokningar</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Hej {data.customer.name}</h1></div></div><p className="mt-4 max-w-2xl text-sm leading-7 text-white/80">Här visas endast dina egna bokningar. Du kan lägga till tiden i kalendern, boka om eller avboka utan konto.</p></header>
      {query?.changed === "1" ? <p role="status" className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]">Tiden har ändrats och bokningen väntar nu på företagets bekräftelse.</p> : null}
      <section className="rounded-[24px] border border-[#dfe6df] bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#17452f]" /><h2 className="text-xl font-bold text-[#17201a]">Kommande</h2></div><div className="mt-5 grid gap-4 md:grid-cols-2">{data.upcoming.length ? data.upcoming.map((booking) => <BookingCard key={booking.id} booking={booking} token={token} timeZone={data.timeZone} />) : <p className="text-sm text-[#667168]">Du har inga kommande bokningar.</p>}</div></section>
      <section className="rounded-[24px] border border-[#dfe6df] bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><History className="h-5 w-5 text-[#17452f]" /><h2 className="text-xl font-bold text-[#17201a]">Historik</h2></div><div className="mt-5 grid gap-4 md:grid-cols-2">{data.history.length ? data.history.map((booking) => <BookingCard key={booking.id} booking={booking} token={token} timeZone={data.timeZone} />) : <p className="text-sm text-[#667168]">Ingen bokningshistorik ännu.</p>}</div></section>
    </div></main>
  );
}
