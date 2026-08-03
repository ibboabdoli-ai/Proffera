import Link from "next/link";
import { AlertCircle, CalendarClock, CalendarDays, CalendarPlus, Clock3, Download, UserRoundCheck } from "lucide-react";

import { BusinessCalendar } from "@/components/dashboard/business-calendar";
import { DashboardLocaleBoundary } from "@/components/dashboard/dashboard-locale-boundary";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardCalendarEvents, type DashboardCalendarEvent } from "@/lib/dashboard-calendar";
import { getDashboardWorkspaceSettings } from "@/lib/workspace-settings-db";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

export const dynamic = "force-dynamic";

type CalendarPageProps = { searchParams?: Promise<{ lang?: string | string[] }> };

function localizedHref(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

function localDateKey(value: Date | string, timeZone: WorkspaceTimeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatTimeRange(event: DashboardCalendarEvent, timeZone: WorkspaceTimeZone, isEnglish: boolean) {
  const formatter = new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${formatter.format(new Date(event.startsAt))}–${formatter.format(new Date(event.endsAt))}`;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const lang = Array.isArray(params?.lang) ? params.lang[0] : params?.lang;
  const isEnglish = lang === "en";
  const [events, workspaceSettings] = await Promise.all([getDashboardCalendarEvents(), getDashboardWorkspaceSettings()]);
  const timeZone = workspaceSettings.timeZone;
  const bookingEvents = events.filter((event) => event.type === "booking");
  const bookingCount = bookingEvents.length;
  const blockCount = events.filter((event) => event.type === "block").length;
  const todayKey = localDateKey(new Date(), timeZone);
  const todayBookings = bookingEvents.filter((event) => localDateKey(event.startsAt, timeZone) === todayKey && !["cancelled", "no_show"].includes(event.status));
  const unassignedBookings = bookingEvents.filter((event) => !event.staffId && !["completed", "cancelled", "no_show"].includes(event.status));
  const now = Date.now();
  const upcomingBookings = bookingEvents
    .filter((event) => new Date(event.endsAt).getTime() >= now && !["cancelled", "no_show"].includes(event.status))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 6);

  return (
    <DashboardLocaleBoundary isEnglish={isEnglish}>
      <div className="grid gap-6">
        <DashboardPageHeader
          eyebrow={isEnglish ? "Calendar" : "Kalender"}
          title={isEnglish ? "Business booking calendar" : "Företagets bokningskalender"}
          description={isEnglish ? "Plan bookings, staff and unavailable time from one workspace-safe view." : "Planera bokningar, personal och otillgänglig tid i en workspace-säker vy."}
          icon={CalendarDays}
          actions={<div className="flex flex-wrap gap-2">
            <Link href={localizedHref("/api/dashboard/calendar/export", isEnglish)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfd9d0] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f] hover:bg-[#f3f7f3]"><Download className="h-4 w-4" aria-hidden="true" />{isEnglish ? "Export" : "Exportera"}</Link>
            <Link href={localizedHref("/dashboard/bokningar/blockera", isEnglish)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfd9d0] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f] hover:bg-[#f3f7f3]"><Clock3 className="h-4 w-4" aria-hidden="true" />{isEnglish ? "Block time" : "Blockera tid"}</Link>
            <Link href={localizedHref("/dashboard/bokningar/ny", isEnglish)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0f3020]"><CalendarPlus className="h-4 w-4" aria-hidden="true" />{isEnglish ? "New booking" : "Ny bokning"}</Link>
          </div>}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-[#6c786f]">{isEnglish ? "Today" : "Idag"}</p><CalendarClock className="h-4 w-4 text-[#6c786f]" /></div><p className="mt-1 text-2xl font-black text-[#173e2b]">{todayBookings.length}</p><p className="mt-1 text-xs text-[#68736b]">{isEnglish ? "active bookings" : "aktiva bokningar"}</p></div>
          <div className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-[#6c786f]">{isEnglish ? "Bookings" : "Bokningar"}</p><CalendarDays className="h-4 w-4 text-[#6c786f]" /></div><p className="mt-1 text-2xl font-black text-[#173e2b]">{bookingCount}</p><p className="mt-1 text-xs text-[#68736b]">{isEnglish ? "in visible period" : "i visningsperioden"}</p></div>
          <div className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-[#6c786f]">{isEnglish ? "Unassigned" : "Ej fördelade"}</p><AlertCircle className="h-4 w-4 text-[#9a6a00]" /></div><p className="mt-1 text-2xl font-black text-[#8a5e00]">{unassignedBookings.length}</p><p className="mt-1 text-xs text-[#68736b]">{isEnglish ? "need an owner" : "behöver ansvarig"}</p></div>
          <div className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-[#6c786f]">{isEnglish ? "Blocked" : "Blockerat"}</p><Clock3 className="h-4 w-4 text-[#6c786f]" /></div><p className="mt-1 text-2xl font-black text-[#30363d]">{blockCount}</p><p className="mt-1 text-xs text-[#68736b]">{isEnglish ? "unavailable periods" : "otillgängliga perioder"}</p></div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <BusinessCalendar events={events} timeZone={timeZone} />

          <aside className="h-fit rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm xl:sticky xl:top-24">
            <div className="flex items-center justify-between gap-3 border-b border-[#edf0eb] pb-3">
              <div><p className="text-xs font-bold uppercase tracking-wide text-[#6c786f]">{isEnglish ? "Next" : "Nästa"}</p><h2 className="mt-1 text-lg font-black text-[#17201a]">{isEnglish ? "Upcoming bookings" : "Kommande bokningar"}</h2></div>
              <UserRoundCheck className="h-5 w-5 text-[#17452f]" />
            </div>
            <div className="mt-3 grid gap-2">
              {upcomingBookings.length ? upcomingBookings.map((event) => (
                <Link key={event.id} href={localizedHref(`/dashboard/bokningar/${event.id}`, isEnglish)} className="rounded-xl border border-[#e4e9e2] p-3 transition hover:border-[#b9cbbd] hover:bg-[#f8faf8]">
                  <div className="flex items-start justify-between gap-3"><p className="font-bold text-[#17201a]">{event.customerName || (isEnglish ? "Unknown customer" : "Okänd kund")}</p><span className="shrink-0 rounded-full bg-[#eef5f0] px-2 py-1 text-[10px] font-bold uppercase text-[#17452f]">{event.status}</span></div>
                  <p className="mt-1 text-sm font-semibold text-[#4f5c53]">{event.service}</p>
                  <p className="mt-1 text-xs text-[#6b766e]">{new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(new Date(event.startsAt))} · {formatTimeRange(event, timeZone, isEnglish)}</p>
                  <p className="mt-1 text-xs text-[#6b766e]">{event.staffName || (isEnglish ? "Unassigned" : "Ej fördelad")}</p>
                </Link>
              )) : <p className="rounded-xl border border-dashed border-[#dce3da] p-4 text-sm text-[#6b766e]">{isEnglish ? "No upcoming bookings." : "Inga kommande bokningar."}</p>}
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap gap-3 text-xs font-semibold text-[#536158]">
          <span className="rounded-full bg-[#fff4d7] px-3 py-1.5">{isEnglish ? "Requested" : "Förfrågan"}</span>
          <span className="rounded-full bg-[#e7f1eb] px-3 py-1.5">{isEnglish ? "Confirmed" : "Bekräftad"}</span>
          <span className="rounded-full bg-[#e7edf8] px-3 py-1.5">{isEnglish ? "Completed" : "Klar"}</span>
          <span className="rounded-full bg-[#f8e7e7] px-3 py-1.5">{isEnglish ? "Cancelled" : "Avbokad"}</span>
          <span className="rounded-full bg-[#eef0f2] px-3 py-1.5">{isEnglish ? "Blocked time" : "Blockerad tid"}</span>
          <span className="ml-auto text-[#7a857d]">{isEnglish ? "Period: 6 months back · 18 months ahead" : "Period: 6 månader bakåt · 18 månader framåt"}</span>
        </div>
      </div>
    </DashboardLocaleBoundary>
  );
}
