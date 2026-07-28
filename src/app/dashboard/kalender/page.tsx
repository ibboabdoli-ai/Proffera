import Link from "next/link";
import { CalendarDays, CalendarPlus, Clock3 } from "lucide-react";

import { BusinessCalendar } from "@/components/dashboard/business-calendar";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardCalendarEvents } from "@/lib/dashboard-calendar";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const events = await getDashboardCalendarEvents();
  const bookingCount = events.filter((event) => event.type === "booking").length;
  const blockCount = events.filter((event) => event.type === "block").length;

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Kalender"
        title="Företagets bokningskalender"
        description="Se kundbokningar och blockerade tider i samma kalender. Kalendern visar endast information från den aktiva arbetsytan."
        icon={CalendarDays}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/bokningar/blockera" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfd9d0] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f] hover:bg-[#f3f7f3]">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Blockera tid
            </Link>
            <Link href="/dashboard/bokningar/ny" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0f3020]">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Ny bokning
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-[#6c786f]">Bokningar</p><p className="mt-1 text-2xl font-black text-[#173e2b]">{bookingCount}</p></div>
        <div className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-[#6c786f]">Blockerade tider</p><p className="mt-1 text-2xl font-black text-[#30363d]">{blockCount}</p></div>
        <div className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wide text-[#6c786f]">Visningsperiod</p><p className="mt-1 text-sm font-bold text-[#17201a]">6 månader bakåt · 18 månader framåt</p></div>
      </div>

      <BusinessCalendar events={events} />

      <div className="flex flex-wrap gap-3 text-xs font-semibold text-[#536158]">
        <span className="rounded-full bg-[#fff4d7] px-3 py-1.5">Förfrågan</span>
        <span className="rounded-full bg-[#e7f1eb] px-3 py-1.5">Bekräftad</span>
        <span className="rounded-full bg-[#e7edf8] px-3 py-1.5">Klar</span>
        <span className="rounded-full bg-[#f8e7e7] px-3 py-1.5">Avbokad</span>
        <span className="rounded-full bg-[#eef0f2] px-3 py-1.5">Blockerad tid</span>
      </div>
    </div>
  );
}
