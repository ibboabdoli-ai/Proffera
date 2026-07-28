"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { DashboardCalendarEvent } from "@/lib/dashboard-calendar";

type ViewMode = "month" | "week";

const statusLabels: Record<string, string> = {
  draft: "Utkast",
  requested: "Förfrågan",
  confirmed: "Bekräftad",
  completed: "Klar",
  cancelled: "Avbokad",
  no_show: "Uteblev",
  leave: "Ledighet",
  sick: "Sjukfrånvaro",
  break: "Rast",
  other: "Ej tillgänglig",
};

function stockholmParts(value: Date | string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() - day + 1);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function eventStyle(event: DashboardCalendarEvent) {
  if (event.type === "time_off") return "border-[#8f5f75] bg-[#f6eaf0] text-[#6d2848]";
  if (event.type === "block") return "border-[#5d6670] bg-[#eef0f2] text-[#30363d]";
  if (event.status === "confirmed") return "border-[#75a489] bg-[#e7f1eb] text-[#17452f]";
  if (event.status === "requested") return "border-[#d3ad54] bg-[#fff4d7] text-[#6f4f00]";
  if (event.status === "cancelled" || event.status === "no_show") return "border-[#d8a1a1] bg-[#f8e7e7] text-[#7a1f1f]";
  if (event.status === "completed") return "border-[#9caecb] bg-[#e7edf8] text-[#1f3f6f]";
  return "border-[#c8d2c6] bg-[#f1f2ed] text-[#4f5b53]";
}

export function BusinessCalendar({ events }: { events: DashboardCalendarEvent[] }) {
  const todayKey = stockholmParts(new Date()).date;
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date(`${todayKey}T00:00:00Z`));
  const [status, setStatus] = useState("all");
  const [staffId, setStaffId] = useState("all");

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    events.forEach((event) => {
      if (event.staffId && event.staffName) map.set(event.staffId, event.staffName);
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "sv"));
  }, [events]);

  const visibleEvents = useMemo(() => events.filter((event) => {
    const statusMatch =
      status === "all" ||
      (status === "block" ? event.type === "block" : status === "time_off" ? event.type === "time_off" : event.type === "booking" && event.status === status);
    const staffMatch = staffId === "all" || (staffId === "unassigned" ? event.type === "booking" && !event.staffId : event.staffId === staffId);
    return statusMatch && staffMatch;
  }), [events, staffId, status]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DashboardCalendarEvent[]>();
    visibleEvents.forEach((event) => {
      const key = stockholmParts(event.startsAt).date;
      map.set(key, [...(map.get(key) ?? []), event]);
    });
    return map;
  }, [visibleEvents]);

  const days = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }
    const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  }, [cursor, view]);

  const title = new Intl.DateTimeFormat("sv-SE", view === "month" ? { month: "long", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(cursor);
  const move = (direction: number) => setCursor((current) => view === "month" ? new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + direction, 1)) : addDays(current, direction * 7));

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => move(-1)} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d7dfd5]" aria-label="Föregående"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(new Date(`${todayKey}T00:00:00Z`))} className="min-h-10 rounded-xl border border-[#d7dfd5] px-4 text-sm font-bold">Idag</button>
          <button type="button" onClick={() => move(1)} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d7dfd5]" aria-label="Nästa"><ChevronRight className="h-4 w-4" /></button>
          <h2 className="ml-1 text-lg font-bold capitalize text-[#17201a]">{title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-10 rounded-xl border border-[#d7dfd5] bg-white px-3 text-sm font-semibold">
            <option value="all">Alla händelser</option><option value="requested">Förfrågningar</option><option value="confirmed">Bekräftade</option><option value="completed">Klara</option><option value="cancelled">Avbokade</option><option value="block">Blockerad tid</option><option value="time_off">Frånvaro och raster</option>
          </select>
          <select value={staffId} onChange={(event) => setStaffId(event.target.value)} className="min-h-10 rounded-xl border border-[#d7dfd5] bg-white px-3 text-sm font-semibold">
            <option value="all">All personal</option>
            <option value="unassigned">Ej fördelade</option>
            {staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {(["month", "week"] as ViewMode[]).map((mode) => <button key={mode} type="button" onClick={() => setView(mode)} className={`min-h-10 rounded-xl px-4 text-sm font-bold ${view === mode ? "bg-[#173e2b] text-white" : "border border-[#d7dfd5] bg-white"}`}>{mode === "month" ? "Månad" : "Vecka"}</button>)}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#dfe5dc] bg-white shadow-sm">
        <div className="min-w-[850px] grid grid-cols-7 border-b border-[#e4e8e2] bg-[#f7f9f6] text-center text-xs font-bold uppercase tracking-wide text-[#6b766e]">
          {['Mån','Tis','Ons','Tor','Fre','Lör','Sön'].map((day) => <div key={day} className="px-2 py-3">{day}</div>)}
        </div>
        <div className="min-w-[850px] grid grid-cols-7">
          {days.map((day) => {
            const key = dateKey(day);
            const dayEvents = eventsByDate.get(key) ?? [];
            const outsideMonth = view === "month" && day.getUTCMonth() !== cursor.getUTCMonth();
            return <div key={key} className={`min-h-36 border-b border-r border-[#edf0eb] p-2 ${outsideMonth ? "bg-[#fafbf9] text-[#9aa39c]" : "bg-white"}`}>
              <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${key === todayKey ? "bg-[#173e2b] text-white" : ""}`}>{day.getUTCDate()}</div>
              <div className="grid gap-1.5">
                {dayEvents.slice(0, view === "month" ? 4 : 12).map((event) => {
                  const href = event.type === "booking" ? `/dashboard/bokningar/${event.id}` : event.type === "time_off" ? "/dashboard/personal/tider" : "/dashboard/bokningar/blockera";
                  const time = stockholmParts(event.startsAt).time;
                  const staffLabel = event.type === "booking" ? event.staffName || "Ej fördelad" : event.staffName;
                  const primaryLabel = event.type === "booking" ? event.customerName : event.title;
                  const secondaryLabel = event.type === "time_off" ? `${event.service}${staffLabel ? ` · ${staffLabel}` : ""}` : `${event.service} · ${statusLabels[event.status] ?? event.status}${staffLabel ? ` · ${staffLabel}` : ""}`;
                  return <Link key={event.id} href={href} title={`${time} ${event.title}`} className={`block rounded-lg border-l-4 px-2 py-1.5 text-xs leading-4 ${eventStyle(event)}`}>
                    <span className="font-black">{time}</span> <span className="font-semibold">{primaryLabel}</span>
                    {view === "week" ? <span className="mt-0.5 block opacity-80">{secondaryLabel}</span> : staffLabel ? <span className="mt-0.5 block truncate opacity-75">{staffLabel}</span> : null}
                  </Link>;
                })}
                {dayEvents.length > (view === "month" ? 4 : 12) ? <p className="px-1 text-xs font-semibold text-[#667168]">+{dayEvents.length - (view === "month" ? 4 : 12)} till</p> : null}
              </div>
            </div>;
          })}
        </div>
      </div>
    </div>
  );
}
