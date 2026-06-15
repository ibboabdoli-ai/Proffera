"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Scissors, UserCheck } from "lucide-react";
import { salonServices } from "@/lib/salon-demo";

export type SalonBooking = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceName: string;
  servicePrice: string;
  serviceDuration: string;
  staffName: string;
  date: string;
  dateLabel: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

const STORAGE_KEY = "proffera:julius-salong:bookings";
const baseMonday = new Date(2026, 5, 15);
const dayNames = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"] as const;
const monthShortNames = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"] as const;
const monthNames = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"] as const;

function parseMinutes(duration: string) {
  const match = duration.match(/\d+/);
  return match ? Number(match[0]) : 30;
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(date: Date) {
  return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
}

function formatCompactDate(date: Date) {
  return `${date.getDate()} ${monthShortNames[date.getMonth()]}`;
}

function getWeekNumber(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function generateSlots(duration: number, date: Date) {
  if (date.getDay() === 0) return [];

  const start = toMinutes("10:00");
  const close = date.getDay() === 6 ? toMinutes("15:00") : toMinutes("18:00");
  const slots: string[] = [];

  for (let time = start; time + duration <= close; time += duration) {
    slots.push(toTime(time));
  }

  return slots;
}

export function readStoredSalonBookings(): SalonBooking[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeStoredSalonBookings(bookings: SalonBooking[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  window.dispatchEvent(new Event("proffera-salon-bookings-updated"));
}

export function BookingWidget() {
  const [selectedServiceIndex, setSelectedServiceIndex] = useState(0);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [showAllTimes, setShowAllTimes] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [submittedBooking, setSubmittedBooking] = useState<SalonBooking | null>(null);
  const [error, setError] = useState("");

  const featuredServices = useMemo(() => salonServices.slice(0, 6), []);
  const selectedService = featuredServices[selectedServiceIndex] ?? featuredServices[0];
  const duration = parseMinutes(selectedService.duration);
  const selectedWeekStart = addDays(baseMonday, weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(selectedWeekStart, index));
  const selectedDate = weekDays[selectedDayIndex] ?? weekDays[0];
  const selectedDateValue = formatDateValue(selectedDate);
  const bookedTimes = new Set(
    readStoredSalonBookings()
      .filter((booking) => booking.date === selectedDateValue && booking.staffName === "Elias" && booking.status !== "cancelled")
      .map((booking) => booking.time),
  );
  const slots = generateSlots(duration, selectedDate).filter((slot) => !bookedTimes.has(slot));
  const visibleSlots = showAllTimes ? slots : slots.slice(0, 6);
  const normalizedSelectedTime = slots.includes(selectedTime) ? selectedTime : slots[0] ?? "";
  const referenceNumber = submittedBooking ? `JS-${submittedBooking.id.slice(-4)}` : "";

  function resetTimeSelection() {
    setSelectedTime("10:00");
    setShowAllTimes(false);
  }

  function handleServiceSelect(index: number) {
    setSelectedServiceIndex(index);
    resetTimeSelection();
  }

  function handleDaySelect(index: number) {
    setSelectedDayIndex(index);
    resetTimeSelection();
  }

  function handleWeekChange(direction: -1 | 1) {
    setWeekOffset((current) => current + direction);
    setSelectedDayIndex(0);
    resetTimeSelection();
  }

  function handleSubmit() {
    setError("");

    if (!normalizedSelectedTime) {
      setError("Välj en dag med lediga tider.");
      return;
    }

    const current = readStoredSalonBookings();
    const alreadyBooked = current.some(
      (booking) => booking.date === selectedDateValue && booking.time === normalizedSelectedTime && booking.staffName === "Elias" && booking.status !== "cancelled",
    );

    if (alreadyBooked) {
      setError("Den tiden är redan bokad. Välj en annan tid.");
      return;
    }

    if (!customerName.trim() || !customerPhone.trim() || !customerEmail.trim()) {
      setError("Fyll i namn, telefon och e-post för att skicka bokningen.");
      return;
    }

    const booking: SalonBooking = {
      id: `booking-${Date.now()}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail.trim(),
      serviceName: selectedService.name,
      servicePrice: selectedService.price,
      serviceDuration: selectedService.duration,
      staffName: "Elias",
      date: selectedDateValue,
      dateLabel: formatDateLabel(selectedDate),
      time: normalizedSelectedTime,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    writeStoredSalonBookings([booking, ...current]);
    setSubmittedBooking(booking);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
  }

  if (submittedBooking) {
    return (
      <div className="mt-6 rounded-[1.7rem] bg-white p-5 text-[#17201a] shadow-2xl lg:mt-0 lg:p-6">
        <div className="rounded-3xl bg-[#e7f1eb] p-5 text-[#17452f]">
          <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-black">Bokningsförfrågan skickad</h2>
          <p className="mt-2 text-sm leading-6">Vi kontaktar dig så snart frisören har godkänt tiden.</p>
          <p className="mt-3 rounded-2xl bg-white/80 px-4 py-3 text-xs font-black leading-5">Detta är en demo. Ingen riktig bokning skickas.</p>
          <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-black">Referensnummer: {referenceNumber}</p>
        </div>

        <div className="mt-5 rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4 text-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[#dfe5dd] pb-3">
            <span className="font-bold">Status</span>
            <span className="rounded-full bg-[#fff6dd] px-3 py-1 text-xs font-black text-[#8a5b00]">Väntar på godkännande</span>
          </div>
          <div className="mt-4 grid gap-2 text-[#344139]">
            <p><strong>Tjänst:</strong> {submittedBooking.serviceName}</p>
            <p><strong>Datum:</strong> {submittedBooking.dateLabel}</p>
            <p><strong>Tid:</strong> {submittedBooking.time}</p>
            <p><strong>Pris:</strong> {submittedBooking.servicePrice}</p>
            <p><strong>Frisör:</strong> {submittedBooking.staffName}</p>
          </div>
        </div>

        <button className="mt-5 w-full rounded-full bg-[#17452f] px-5 py-3 text-sm font-black text-white" type="button" onClick={() => setSubmittedBooking(null)}>Skapa ny bokning</button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-[1.7rem] bg-white p-4 text-[#17201a] shadow-2xl lg:mt-0 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#17452f]">Bokningsdemo</p>
          <h2 className="mt-1 text-2xl font-black">Boka hos Elias</h2>
        </div>
        <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-bold text-[#17452f]">Månadsvy</span>
      </div>

      <p className="mt-4 rounded-2xl bg-[#fff6dd] px-4 py-3 text-xs font-black leading-5 text-[#8a5b00]">
        Detta är en demo. Ingen riktig bokning skickas.
      </p>

      <div className="mt-5 rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
          <h3 className="text-lg font-black">1. Välj tjänst</h3>
        </div>
        <div className="mt-4 grid gap-3">
          {featuredServices.map((service, index) => (
            <button key={service.name} className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 text-left ${index === selectedServiceIndex ? "border-[#17452f] bg-white shadow-sm" : "border-[#dfe5dd] bg-white"}`} onClick={() => handleServiceSelect(index)} type="button">
              <span>
                <span className="block text-sm font-black">{service.name}</span>
                <span className="mt-1 block text-xs font-semibold text-[#5b665f]">{service.duration}</span>
              </span>
              <span className="text-base font-black text-[#17452f]">{service.price}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
            <div>
              <h3 className="text-lg font-black">2. Välj tid</h3>
              <p className="text-xs font-bold text-[#5b665f]">Vecka {getWeekNumber(selectedWeekStart)} • {formatCompactDate(selectedWeekStart)} - {formatCompactDate(addDays(selectedWeekStart, 6))}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-full border border-[#dfe5dd] bg-white p-2" type="button" onClick={() => handleWeekChange(-1)} aria-label="Tidigare vecka"><ChevronLeft className="h-4 w-4" /></button>
            <button className="rounded-full border border-[#dfe5dd] bg-white p-2" type="button" onClick={() => handleWeekChange(1)} aria-label="Nästa vecka"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {weekDays.map((date, index) => {
            const selected = index === selectedDayIndex;
            const closed = date.getDay() === 0;
            return (
              <button key={formatDateValue(date)} className={`rounded-2xl px-1 py-3 text-center text-xs font-black ${selected ? "bg-[#17452f] text-white" : closed ? "bg-[#f0f0ec] text-[#9aa89f]" : "border border-[#dfe5dd] bg-white text-[#344139]"}`} type="button" onClick={() => handleDaySelect(index)}>
                <span className="block">{dayNames[date.getDay()]}</span>
                <span className="mt-1 block text-[11px]">{formatCompactDate(date)}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slots.length > 0 ? visibleSlots.map((slot) => (
            <button key={slot} className={`rounded-2xl px-3 py-3 text-left text-sm font-black ${slot === normalizedSelectedTime ? "bg-[#17452f] text-white shadow-sm" : "border border-[#dfe5dd] bg-white text-[#344139]"}`} onClick={() => setSelectedTime(slot)} type="button">
              <span className="block">{slot}</span>
              <span className={`mt-1 block text-xs ${slot === normalizedSelectedTime ? "text-white/75" : "text-[#5b665f]"}`}>{selectedService.price}</span>
            </button>
          )) : (
            <p className="col-span-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#5b665f]">Inga lediga tider denna dag.</p>
          )}
        </div>

        {slots.length > 6 ? (
          <button className="mt-3 w-full rounded-full border border-[#17452f] bg-white px-4 py-3 text-sm font-black text-[#17452f]" type="button" onClick={() => setShowAllTimes((current) => !current)}>
            {showAllTimes ? "Visa färre tider" : `Visa fler tider (${slots.length - 6})`}
          </button>
        ) : null}
      </div>

      <div className="mt-4 rounded-3xl border border-[#dfe5dd] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#17452f]">Du har valt</p>
        <div className="mt-3 grid gap-2 text-sm text-[#344139]">
          <p><strong>{selectedService.name}</strong></p>
          <p>{selectedService.duration} • {selectedService.price}</p>
          <p>Frisör: Elias</p>
          <p>{formatDateLabel(selectedDate)} • {normalizedSelectedTime || "Ingen tid vald"}</p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
        <div className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
          <h3 className="text-lg font-black">3. Dina uppgifter</h3>
        </div>
        <div className="mt-4 grid gap-3">
          <input className="rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base" placeholder="Namn" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          <input className="rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base" placeholder="Telefon" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
          <input className="rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base" placeholder="E-post" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} />
        </div>
        {error ? <p className="mt-3 rounded-2xl bg-[#ffe9e9] px-3 py-2 text-xs font-bold text-[#9a1c1c]">{error}</p> : null}
        <button className="mt-4 flex w-full items-center justify-center rounded-full bg-[#17452f] px-5 py-4 text-base font-black text-white shadow-lg shadow-[#17452f]/20" type="button" onClick={handleSubmit}>
          Skicka bokningsförfrågan <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
