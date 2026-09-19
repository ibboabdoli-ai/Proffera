import Link from "next/link";
import { AlertCircle, CalendarClock, CalendarDays, CalendarPlus, Clock3, Download, UserRoundCheck } from "lucide-react";

import { BusinessCalendar } from "@/components/dashboard/business-calendar";
import { DashboardLocaleBoundary } from "@/components/dashboard/dashboard-locale-boundary";
import { DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
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

  const metrics = [
    {
      label: isEnglish ? "Today" : "Idag",
      value: String(todayBookings.length),
      helper: isEnglish ? "Active bookings today" : "Aktiva bokningar idag",
      icon: CalendarClock,
      tone: "bg-[#eef5ff] text-[#1469d8]",
    },
    {
      label: isEnglish ? "Bookings" : "Bokningar",
      value: String(bookingCount),
      helper: isEnglish ? "In the visible period" : "I visningsperioden",
      icon: CalendarDays,
      tone: "bg-[#eef5ff] text-[#0a2e63]",
    },
    {
      label: isEnglish ? "Unassigned" : "Ej fördelade",
      value: String(unassignedBookings.length),
      helper: isEnglish ? "Bookings needing an owner" : "Bokningar som behöver ansvarig",
      icon: AlertCircle,
      tone: "bg-[#fff7df] text-[#805d14]",
    },
    {
      label: isEnglish ? "Blocked" : "Blockerat",
      value: String(blockCount),
      helper: isEnglish ? "Unavailable periods" : "Otillgängliga perioder",
      icon: Clock3,
      tone: "bg-surface-subtle text-brand-deep",
    },
  ];

  return (
    <DashboardLocaleBoundary isEnglish={isEnglish}>
      <div className="grid gap-6">
        <DashboardPageHeader
          eyebrow={isEnglish ? "Calendar" : "Kalender"}
          title={isEnglish ? "Business booking calendar" : "Företagets bokningskalender"}
          description={isEnglish ? "Plan bookings, staff and unavailable time from one workspace-safe view." : "Planera bokningar, personal och otillgänglig tid i en workspace-säker vy."}
          icon={CalendarDays}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={localizedHref("/api/dashboard/calendar/export", isEnglish)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-bold text-brand-deep hover:bg-surface-subtle">
                <Download className="h-4 w-4" aria-hidden="true" />{isEnglish ? "Export" : "Exportera"}
              </Link>
              <Link href={localizedHref("/dashboard/bokningar/blockera", isEnglish)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-bold text-brand-deep hover:bg-surface-subtle">
                <Clock3 className="h-4 w-4" aria-hidden="true" />{isEnglish ? "Block time" : "Blockera tid"}
              </Link>
              <Link href={localizedHref("/dashboard/bokningar/ny", isEnglish)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand-deep px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover">
                <CalendarPlus className="h-4 w-4" aria-hidden="true" />{isEnglish ? "New booking" : "Ny bokning"}
              </Link>
            </div>
          }
        />

        <DashboardMetricGrid items={metrics} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <BusinessCalendar events={events} timeZone={timeZone} />

          <aside className="h-fit rounded-card border border-line bg-surface p-4 shadow-card xl:sticky xl:top-24">
            <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{isEnglish ? "Next" : "Nästa"}</p>
                <h2 className="mt-1 text-lg font-bold text-ink">{isEnglish ? "Upcoming bookings" : "Kommande bokningar"}</h2>
              </div>
              <UserRoundCheck className="h-5 w-5 text-brand" aria-hidden="true" />
            </div>

            <div className="mt-3 divide-y divide-line">
              {upcomingBookings.length ? upcomingBookings.map((event) => (
                <Link key={event.id} href={localizedHref(`/dashboard/bokningar/${event.id}`, isEnglish)} className="block py-3 transition hover:bg-surface-subtle">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-ink">{event.customerName || (isEnglish ? "Unknown customer" : "Okänd kund")}</p>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${event.status === "confirmed" ? "bg-[#eaf8f2] text-[#087754]" : event.status === "requested" ? "bg-[#fff7df] text-[#805d14]" : "bg-[#eef5ff] text-brand"}`}>
                      {event.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-ink-muted">{event.service}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(new Date(event.startsAt))} · {formatTimeRange(event, timeZone, isEnglish)}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">{event.staffName || (isEnglish ? "Unassigned" : "Ej fördelad")}</p>
                </Link>
              )) : (
                <p className="rounded-card border border-dashed border-line-strong bg-surface-subtle p-4 text-sm text-ink-muted">
                  {isEnglish ? "No upcoming bookings." : "Inga kommande bokningar."}
                </p>
              )}
            </div>
          </aside>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
          <span className="rounded-full bg-[#fff7df] px-3 py-1.5">{isEnglish ? "Requested" : "Förfrågan"}</span>
          <span className="rounded-full bg-[#eaf8f2] px-3 py-1.5">{isEnglish ? "Confirmed" : "Bekräftad"}</span>
          <span className="rounded-full bg-[#eef5ff] px-3 py-1.5">{isEnglish ? "Completed" : "Klar"}</span>
          <span className="rounded-full bg-danger/10 px-3 py-1.5 text-danger">{isEnglish ? "Cancelled" : "Avbokad"}</span>
          <span className="rounded-full bg-surface-subtle px-3 py-1.5">{isEnglish ? "Blocked time" : "Blockerad tid"}</span>
          <span className="ml-auto text-ink-muted">{isEnglish ? "Period: 6 months back · 18 months ahead" : "Period: 6 månader bakåt · 18 månader framåt"}</span>
        </div>
      </div>
    </DashboardLocaleBoundary>
  );
}
