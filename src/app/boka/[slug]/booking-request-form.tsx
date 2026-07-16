"use client";

import { useMemo, useState } from "react";

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

export function BookingRequestForm({ action, slug, services, bookingHours, busyBookings }: BookingRequestFormProps) {
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

  return (
    <form action={action} className="mt-8 grid gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="starts_at" value={date && time ? `${date}T${time}` : ""} />

      <label className="grid gap-2 text-sm font-semibold text-[#344139]">Ditt namn<input name="name" required autoComplete="name" className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[#344139]">E-post<input name="email" type="email" autoComplete="email" className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" /></label>
        <label className="grid gap-2 text-sm font-semibold text-[#344139]">Telefon<input name="phone" type="tel" autoComplete="tel" className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-[#17201a]" /></label>
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
