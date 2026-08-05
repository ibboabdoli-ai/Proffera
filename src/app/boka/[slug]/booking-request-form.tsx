"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, MailCheck, Scissors, UserRound } from "lucide-react";

import {
  addDaysToDateInput,
  dateInputInTimeZone,
  getAvailableBookingTimes,
  type BookingAvailabilityBusyBooking,
  type BookingAvailabilityHour,
  type BookingAvailabilityService,
} from "@/lib/public-booking-availability";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

type BookingService = BookingAvailabilityService & { name: string; priceLabel: string };
type BookingHour = BookingAvailabilityHour & { weekday: number };
type BusyBooking = BookingAvailabilityBusyBooking;

type BookingRequestFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  slug: string;
  services: BookingService[];
  bookingHours: BookingHour[];
  busyBookings: BusyBooking[];
  timeZone: WorkspaceTimeZone;
  variant?: "default" | "salon";
};

type SalonStep = "service" | "time" | "details";

const weekdayShort = ["Sön", "Mån", "Tis", "Ons", "Tors", "Fre", "Lör"];
const monthShort = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function weekdayForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

function formatDateLabel(value: string) {
  const { day, month, weekday } = dateParts(value);
  return `${weekdayShort[weekday]} ${day} ${monthShort[month - 1]}`;
}

export function BookingRequestForm({ action, slug, services, bookingHours, busyBookings, timeZone, variant = "default" }: BookingRequestFormProps) {
  const [formStartedAt] = useState(() => Date.now());
  const [availabilityReferenceTimeMs, setAvailabilityReferenceTimeMs] = useState(formStartedAt);
  const today = dateInputInTimeZone(new Date(availabilityReferenceTimeMs), timeZone);
  const [serviceName, setServiceName] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [salonStep, setSalonStep] = useState<SalonStep>("service");
  const [weekOffset, setWeekOffset] = useState(0);

  const selectedService = services.find((service) => service.name === serviceName);
  const maximumDate = selectedService ? addDaysToDateInput(today, selectedService.maximumAdvanceDays) : undefined;
  const selectedHours = bookingHours.find((hour) => hour.weekday === weekdayForDate(date));

  const availableTimes = useMemo(() => {
    if (!selectedService || !selectedHours) return [];
    return getAvailableBookingTimes({ date, service: selectedService, hours: selectedHours, busyBookings, referenceTimeMs: availabilityReferenceTimeMs, timeZone });
  }, [availabilityReferenceTimeMs, busyBookings, date, selectedHours, selectedService, timeZone]);

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDaysToDateInput(today, weekOffset * 7 + index)),
    [today, weekOffset],
  );

  const serviceFirstAvailability = useMemo(() => {
    const result = new Map<string, { date: string; time: string } | null>();
    for (const service of services) {
      let match: { date: string; time: string } | null = null;
      const maxDays = Math.min(service.maximumAdvanceDays, 28);
      for (let offset = 0; offset <= maxDays; offset += 1) {
        const candidateDate = addDaysToDateInput(today, offset);
        const hours = bookingHours.find((item) => item.weekday === weekdayForDate(candidateDate));
        if (!hours) continue;
        const slots = getAvailableBookingTimes({ date: candidateDate, service, hours, busyBookings, referenceTimeMs: availabilityReferenceTimeMs, timeZone });
        if (slots.length) {
          match = { date: candidateDate, time: slots[0] };
          break;
        }
      }
      result.set(service.name, match);
    }
    return result;
  }, [availabilityReferenceTimeMs, bookingHours, busyBookings, services, timeZone, today]);

  useEffect(() => {
    const timer = window.setInterval(() => setAvailabilityReferenceTimeMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!weekDates.includes(date)) {
      setDate(weekDates[0]);
      setTime("");
    }
  }, [date, weekDates]);

  const selectedTime = availableTimes.includes(time) ? time : "";

  function chooseService(name: string) {
    const first = serviceFirstAvailability.get(name);
    setServiceName(name);
    setDate(first?.date ?? today);
    setTime("");
    if (first) {
      const distance = new Date(`${first.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime();
      setWeekOffset(Math.max(0, Math.floor(distance / 604800000)));
    } else {
      setWeekOffset(0);
    }
    setSalonStep("time");
  }

  if (variant === "salon") {
    return (
      <form action={action} className="mt-5">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="service" value={serviceName} />
        <input type="hidden" name="starts_at" value={date && selectedTime ? `${date}T${selectedTime}` : ""} />
        <input type="hidden" name="form_started_at" value={formStartedAt} />
        <label className="absolute left-[-10000px]" aria-hidden="true">Webbplats<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>

        <div className="mb-5 grid grid-cols-3 gap-2">
          {[["service", "Tjänst"], ["time", "Tid"], ["details", "Uppgifter"]].map(([key, label], index) => {
            const order = { service: 0, time: 1, details: 2 } as const;
            const current = order[salonStep];
            const active = current === index;
            const complete = current > index;
            return <div key={key} className="text-center"><div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${active ? "bg-[#17452f] text-white" : complete ? "bg-[#dceee2] text-[#17452f]" : "bg-[#eef1ed] text-[#7a857e]"}`}>{complete ? <Check className="h-4 w-4" /> : index + 1}</div><p className={`mt-1 text-xs font-bold ${active ? "text-[#17452f]" : "text-[#7a857e]"}`}>{label}</p></div>;
          })}
        </div>

        {salonStep === "service" ? <section>
          <div className="mb-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#17452f]">Boka online</p><h3 className="mt-1 text-2xl font-black text-[#17201a]">Välj tjänst</h3><p className="mt-2 text-sm leading-6 text-[#5b665f]">Se pris, behandlingstid och närmaste lediga tid.</p></div>
          <div className="grid gap-3">{services.map((service) => {
            const first = serviceFirstAvailability.get(service.name);
            return <article key={service.name} className="rounded-[1.5rem] border border-[#dfe5dd] bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#edf5ef] text-[#17452f]"><Scissors className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h4 className="text-base font-black leading-6 text-[#17201a]">{service.name}</h4><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">{service.priceLabel ? <span className="font-black text-[#17201a]">{service.priceLabel}</span> : null}<span className="inline-flex items-center gap-1 font-bold text-[#5b665f]"><Clock3 className="h-4 w-4" />{service.durationMinutes} min</span></div><p className="mt-2 text-sm font-bold text-[#2873b9]">{first ? `Ledig tid ${formatDateLabel(first.date)} kl. ${first.time}` : "Inga lediga tider de närmaste veckorna"}</p></div></div>
              <button type="button" disabled={!first} onClick={() => chooseService(service.name)} className="mt-4 min-h-12 w-full rounded-2xl bg-[#17452f] px-5 py-3 text-sm font-black text-white transition hover:bg-[#123824] disabled:cursor-not-allowed disabled:bg-[#b9c3bc]">Boka</button>
            </article>;
          })}</div>
        </section> : null}

        {salonStep === "time" && selectedService ? <section>
          <button type="button" onClick={() => setSalonStep("service")} className="mb-4 inline-flex items-center gap-2 text-sm font-black text-[#17452f]"><ArrowLeft className="h-4 w-4" /> Byt tjänst</button>
          <div className="rounded-[1.5rem] border border-[#dfe5dd] bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17452f]">Vald tjänst</p><h3 className="mt-1 text-lg font-black">{selectedService.name}</h3><p className="mt-1 text-sm font-bold text-[#5b665f]">{selectedService.durationMinutes} min{selectedService.priceLabel ? ` · ${selectedService.priceLabel}` : ""}</p></div>
          <div className="mt-4 flex items-center justify-between"><button type="button" disabled={weekOffset === 0} onClick={() => { setWeekOffset((value) => Math.max(0, value - 1)); setTime(""); }} className="rounded-full border border-[#dfe5dd] bg-white p-3 text-[#17452f] disabled:opacity-30"><ArrowLeft className="h-5 w-5" /></button><div className="text-center"><p className="text-sm font-black text-[#17201a]">Välj dag och tid</p><p className="text-xs font-bold text-[#5b665f]">{formatDateLabel(weekDates[0])} – {formatDateLabel(weekDates[6])}</p></div><button type="button" onClick={() => { setWeekOffset((value) => value + 1); setTime(""); }} className="rounded-full bg-[#17452f] p-3 text-white"><ArrowRight className="h-5 w-5" /></button></div>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">{weekDates.map((value) => {
            const parts = dateParts(value);
            const hours = bookingHours.find((item) => item.weekday === parts.weekday);
            const slots = hours ? getAvailableBookingTimes({ date: value, service: selectedService, hours, busyBookings, referenceTimeMs: availabilityReferenceTimeMs, timeZone }) : [];
            const active = value === date;
            return <button key={value} type="button" disabled={!slots.length} onClick={() => { setDate(value); setTime(""); }} className={`rounded-2xl border px-2 py-3 text-center transition ${active ? "border-[#17452f] bg-[#17452f] text-white" : "border-[#dfe5dd] bg-white text-[#344139]"} disabled:cursor-not-allowed disabled:opacity-35`}><span className="block text-xs font-bold">{weekdayShort[parts.weekday]}</span><span className="mt-1 block text-lg font-black">{parts.day}</span></button>;
          })}</div>
          <div className="mt-4 rounded-[1.5rem] border border-[#dfe5dd] bg-[#fbfbf8] p-4"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-[#17452f]" /><h4 className="font-black">{formatDateLabel(date)}</h4></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{availableTimes.length ? availableTimes.map((availableTime) => <button key={availableTime} type="button" onClick={() => setTime(availableTime)} className={`min-h-14 rounded-2xl border px-3 py-3 text-center text-base font-black transition ${selectedTime === availableTime ? "border-[#17452f] bg-[#17452f] text-white" : "border-[#8eb8a2] bg-[#eef8f1] text-[#17452f]"}`}>{availableTime}</button>) : <p className="col-span-full rounded-2xl bg-white p-4 text-sm font-bold text-[#5b665f]">Inga lediga tider den här dagen. Välj en annan dag.</p>}</div></div>
          <button type="button" disabled={!selectedTime} onClick={() => setSalonStep("details")} className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#17452f] px-5 py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-45">Fortsätt <ArrowRight className="ml-2 h-4 w-4" /></button>
        </section> : null}

        {salonStep === "details" && selectedService ? <section>
          <button type="button" onClick={() => setSalonStep("time")} className="mb-4 inline-flex items-center gap-2 text-sm font-black text-[#17452f]"><ArrowLeft className="h-4 w-4" /> Byt tid</button>
          <div className="rounded-[1.5rem] border border-[#dfe5dd] bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#17452f]">Din bokning</p><h3 className="mt-1 text-lg font-black">{selectedService.name}</h3><p className="mt-1 text-sm font-bold text-[#5b665f]">{formatDateLabel(date)} kl. {selectedTime} · {selectedService.durationMinutes} min{selectedService.priceLabel ? ` · ${selectedService.priceLabel}` : ""}</p></div>
          <div className="mt-4 rounded-[1.5rem] border border-[#dfe5dd] bg-[#fbfbf8] p-4"><div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-[#17452f]" /><h3 className="text-lg font-black">Dina uppgifter</h3></div><div className="mt-4 grid gap-3"><label className="grid gap-1.5 text-sm font-bold text-[#344139]">Namn<input name="name" required autoComplete="name" maxLength={160} className="min-h-12 rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#17452f]" /></label><label className="grid gap-1.5 text-sm font-bold text-[#344139]">Telefon<input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={80} className="min-h-12 rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#17452f]" /></label><label className="grid gap-1.5 text-sm font-bold text-[#344139]">E-post<input name="email" required type="email" inputMode="email" autoComplete="email" maxLength={180} className="min-h-12 rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#17452f]" /></label></div><div className="mt-4 flex gap-3 rounded-2xl bg-[#edf5ef] p-3 text-xs font-semibold leading-5 text-[#344139]"><MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#17452f]" /><p>Vi skickar en sexsiffrig kod till din e-post. Bokningen blir klar först när du har verifierat koden.</p></div><button className="mt-4 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#17452f] px-5 py-4 text-base font-black text-white shadow-lg shadow-[#17452f]/20">Skicka verifieringskod <ArrowRight className="ml-2 h-4 w-4" /></button></div>
        </section> : null}
      </form>
    );
  }

  return <form action={action} className="mt-8 grid gap-4">
    <input type="hidden" name="slug" value={slug} /><input type="hidden" name="starts_at" value={date && selectedTime ? `${date}T${selectedTime}` : ""} /><input type="hidden" name="form_started_at" value={formStartedAt} /><label className="absolute left-[-10000px]" aria-hidden="true">Webbplats<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
    <label className="grid gap-2 text-sm font-semibold text-[#344139]">Ditt namn<input name="name" required autoComplete="name" maxLength={160} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-[#344139]">E-post<input name="email" required type="email" autoComplete="email" maxLength={180} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" /></label><label className="grid gap-2 text-sm font-semibold text-[#344139]">Telefon<input name="phone" type="tel" autoComplete="tel" maxLength={80} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" /></label></div>
    <label className="grid gap-2 text-sm font-semibold text-[#344139]">Tjänst<select name="service" required value={serviceName} onChange={(event) => { setServiceName(event.target.value); setTime(""); }} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]"><option value="">Välj tjänst</option>{services.map((service) => <option key={service.name} value={service.name}>{service.name} · {service.durationMinutes} min{service.priceLabel ? ` · ${service.priceLabel}` : ""}</option>)}</select></label>
    <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-[#344139]">Datum<input type="date" required min={today} max={maximumDate} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" /></label><label className="grid gap-2 text-sm font-semibold text-[#344139]">Ledig tid<select required value={selectedTime} onChange={(event) => setTime(event.target.value)} disabled={!selectedService || availableTimes.length === 0} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a] disabled:bg-[#f2f4f1]"><option value="">{selectedService ? (availableTimes.length ? "Välj en tid" : "Inga tider den dagen") : "Välj tjänst först"}</option>{availableTimes.map((availableTime) => <option key={availableTime} value={availableTime}>{availableTime}</option>)}</select></label></div><button className="rounded-xl bg-[#17452f] px-5 py-3 font-bold text-white">Skicka verifieringskod</button>
  </form>;
}
