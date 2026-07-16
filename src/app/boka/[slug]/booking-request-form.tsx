"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, Scissors, UserCheck } from "lucide-react";

type BookingService = {
  name: string;
  durationMinutes: number;
  priceLabel: string;
};

type BookingHour = {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
};

type BusyBooking = {
  startsAt: string;
  endsAt: string;
};

type BookingRequestFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  slug: string;
  services: BookingService[];
  bookingHours: BookingHour[];
  busyBookings: BusyBooking[];
  variant?: "default" | "salon";
};

const stockholmFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toStockholmParts(date: Date) {
  const values = Object.fromEntries(stockholmFormatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function toMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function BookingRequestForm({ action, slug, services, bookingHours, busyBookings, variant = "default" }: BookingRequestFormProps) {
  const today = toStockholmParts(new Date()).date;
  const [serviceName, setServiceName] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");

  const selectedService = services.find((service) => service.name === serviceName);
  const day = new Date(`${date}T12:00:00`).getDay();
  const selectedHours = bookingHours.find((hour) => hour.weekday === day);

  const availableTimes = useMemo(() => {
    if (!selectedService || !selectedHours || selectedHours.isClosed || !date) return [];
    const opensAt = toMinutes(selectedHours.opensAt);
    const closesAt = toMinutes(selectedHours.closesAt);
    const now = toStockholmParts(new Date());
    const blocked = busyBookings
      .map((booking) => ({ start: toStockholmParts(new Date(booking.startsAt)), end: toStockholmParts(new Date(booking.endsAt)) }))
      .filter((booking) => booking.start.date === date || booking.end.date === date);
    const slots: string[] = [];

    for (let start = opensAt; start + selectedService.durationMinutes <= closesAt; start += 30) {
      if (date === now.date && start <= now.minutes) continue;
      const end = start + selectedService.durationMinutes;
      const overlaps = blocked.some((booking) => {
        if (booking.start.date !== date || booking.end.date !== date) return false;
        return start < booking.end.minutes && end > booking.start.minutes;
      });
      if (!overlaps) slots.push(toTime(start));
    }
    return slots;
  }, [busyBookings, date, selectedHours, selectedService]);

  if (variant === "salon") {
    return (
      <form action={action} className="mt-5 grid gap-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="service" value={serviceName} />
        <input type="hidden" name="starts_at" value={date && time ? `${date}T${time}` : ""} />
        <label className="absolute left-[-10000px]" aria-hidden="true">Webbplats<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>

        <section className="rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
            <h3 className="text-lg font-black">1. Välj tjänst</h3>
          </div>
          <div className="mt-4 grid max-h-[24rem] gap-3 overflow-y-auto pr-1">
            {services.map((service) => {
              const selected = service.name === serviceName;
              return (
                <button key={service.name} type="button" aria-pressed={selected} onClick={() => { setServiceName(service.name); setTime(""); }} className={`flex min-h-16 items-center justify-between rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#17452f] ${selected ? "border-[#17452f] bg-white shadow-sm" : "border-[#dfe5dd] bg-white hover:border-[#9fb5a5]"}`}>
                  <span>
                    <span className="block text-sm font-black">{service.name}</span>
                    <span className="mt-1 block text-xs font-semibold text-[#5b665f]">{service.durationMinutes} min</span>
                  </span>
                  {service.priceLabel ? <span className="ml-3 shrink-0 text-base font-black text-[#17452f]">{service.priceLabel}</span> : null}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
            <h3 className="text-lg font-black">2. Välj tid</h3>
          </div>
          <label className="mt-4 grid gap-2 text-sm font-bold text-[#344139]">Datum
            <input type="date" required min={today} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} className="min-h-12 rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base text-[#17201a] focus:outline-none focus:ring-2 focus:ring-[#17452f]" />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selectedService && availableTimes.length ? availableTimes.map((availableTime) => (
              <button key={availableTime} type="button" aria-pressed={time === availableTime} onClick={() => setTime(availableTime)} className={`min-h-12 rounded-2xl px-3 py-3 text-left text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-[#17452f] ${time === availableTime ? "bg-[#17452f] text-white shadow-sm" : "border border-[#dfe5dd] bg-white text-[#344139] hover:border-[#9fb5a5]"}`}>
                <span className="block">{availableTime}</span>
                {selectedService.priceLabel ? <span className={`mt-1 block text-xs ${time === availableTime ? "text-white/75" : "text-[#5b665f]"}`}>{selectedService.priceLabel}</span> : null}
              </button>
            )) : <p className="col-span-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#5b665f]">{selectedService ? "Inga lediga tider denna dag." : "Välj en tjänst först."}</p>}
          </div>
        </section>

        {selectedService ? <section className="rounded-3xl border border-[#dfe5dd] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#17452f]">Du har valt</p>
          <div className="mt-3 grid gap-2 text-sm text-[#344139]">
            <p><strong>{selectedService.name}</strong></p>
            <p>{selectedService.durationMinutes} min{selectedService.priceLabel ? ` • ${selectedService.priceLabel}` : ""}</p>
            <p>Frisör: Elias</p>
            <p>{date} • {time || "Välj en tid"}</p>
          </div>
        </section> : null}

        <section className="rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
            <h3 className="text-lg font-black">3. Dina uppgifter</h3>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm font-bold text-[#344139]">Namn<input name="name" required autoComplete="name" maxLength={160} className="min-h-12 rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base text-[#17201a] focus:outline-none focus:ring-2 focus:ring-[#17452f]" /></label>
            <label className="grid gap-1.5 text-sm font-bold text-[#344139]">Telefon<input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={80} className="min-h-12 rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base text-[#17201a] focus:outline-none focus:ring-2 focus:ring-[#17452f]" /></label>
            <label className="grid gap-1.5 text-sm font-bold text-[#344139]">E-post<input name="email" type="email" inputMode="email" autoComplete="email" maxLength={180} className="min-h-12 rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base text-[#17201a] focus:outline-none focus:ring-2 focus:ring-[#17452f]" /></label>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#5b665f]">Fyll i minst e-post eller telefon så att Julius Salong kan kontakta dig.</p>
          <button disabled={!selectedService || !time} className="mt-4 flex min-h-14 w-full items-center justify-center rounded-full bg-[#17452f] px-5 py-4 text-base font-black text-white shadow-lg shadow-[#17452f]/20 transition hover:bg-[#123824] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2">
            Skicka bokningsförfrågan <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </button>
        </section>
      </form>
    );
  }

  return (
    <form action={action} className="mt-8 grid gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="starts_at" value={date && time ? `${date}T${time}` : ""} />
      <label className="absolute left-[-10000px]" aria-hidden="true">Webbplats<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>

      <label className="grid gap-2 text-sm font-semibold text-[#344139]">Ditt namn<input name="name" required autoComplete="name" maxLength={160} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[#344139]">E-post<input name="email" type="email" autoComplete="email" maxLength={180} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#344139]">Telefon<input name="phone" type="tel" autoComplete="tel" maxLength={80} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" /></label>
      </div>
      <p className="-mt-2 text-xs text-[#5b665f]">Fyll i minst e-post eller telefon så att företaget kan kontakta dig.</p>

      <label className="grid gap-2 text-sm font-semibold text-[#344139]">Tjänst
        <select name="service" required value={serviceName} onChange={(event) => { setServiceName(event.target.value); setTime(""); }} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]">
          <option value="">Välj tjänst</option>
          {services.map((service) => <option key={service.name} value={service.name}>{service.name} · {service.durationMinutes} min{service.priceLabel ? ` · ${service.priceLabel}` : ""}</option>)}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[#344139]">Datum
          <input type="date" required min={today} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#344139]">Ledig tid
          <select required value={time} onChange={(event) => setTime(event.target.value)} disabled={!selectedService || availableTimes.length === 0} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a] disabled:cursor-not-allowed disabled:bg-[#f2f4f1]">
            <option value="">{selectedService ? (availableTimes.length ? "Välj en tid" : "Inga tider den dagen") : "Välj tjänst först"}</option>
            {availableTimes.map((availableTime) => <option key={availableTime} value={availableTime}>{availableTime}</option>)}
          </select>
        </label>
      </div>
      {selectedService && availableTimes.length === 0 ? <p className="rounded-xl bg-[#fff5f2] p-3 text-sm text-[#8f2f1b]">Det finns inga lediga tider för vald tjänst den dagen.</p> : null}
      <button className="rounded-xl bg-[#17452f] px-5 py-3 font-bold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2">Skicka bokningsförfrågan</button>
    </form>
  );
}
