"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, CheckCircle2, Scissors, UserCheck } from "lucide-react";
import { demoTimeSlots, salonServices } from "@/lib/salon-demo";

export type SalonBooking = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceName: string;
  servicePrice: string;
  serviceDuration: string;
  staffName: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
};

const STORAGE_KEY = "proffera:julius-salong:bookings";

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
  const [selectedTime, setSelectedTime] = useState("14:30");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [submittedBooking, setSubmittedBooking] = useState<SalonBooking | null>(null);
  const [error, setError] = useState("");

  const featuredServices = useMemo(() => salonServices.slice(0, 4), []);
  const selectedService = featuredServices[selectedServiceIndex] ?? featuredServices[0];

  function handleSubmit() {
    setError("");

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
      time: selectedTime,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    const current = readStoredSalonBookings();
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
          <p className="mt-2 text-sm leading-6">
            Tack {submittedBooking.customerName}. Din bokning väntar nu på godkännande från salongen.
          </p>
        </div>

        <div className="mt-5 rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4 text-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[#dfe5dd] pb-3">
            <span className="font-bold">Status</span>
            <span className="rounded-full bg-[#fff6dd] px-3 py-1 text-xs font-black text-[#8a5b00]">Väntar på godkännande</span>
          </div>
          <div className="mt-4 grid gap-2 text-[#344139]">
            <p><strong>Tjänst:</strong> {submittedBooking.serviceName}</p>
            <p><strong>Tid:</strong> {submittedBooking.time}</p>
            <p><strong>Pris:</strong> {submittedBooking.servicePrice}</p>
            <p><strong>Frisör:</strong> {submittedBooking.staffName}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button className="rounded-full bg-[#17452f] px-5 py-3 text-sm font-black text-white" type="button" onClick={() => setSubmittedBooking(null)}>
            Skapa ny bokning
          </button>
          <a className="rounded-full border border-[#17452f] bg-white px-5 py-3 text-center text-sm font-black text-[#17452f]" href="/dashboard/salon">
            Visa i dashboard
          </a>
        </div>

        <p className="mt-4 text-xs leading-5 text-[#5b665f]">
          Demo-MVP: bokningen sparas i webbläsaren för att visa flödet i preview. Nästa steg är databas och e-postnotiser.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-[1.7rem] bg-white p-4 text-[#17201a] shadow-2xl lg:mt-0 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[#17452f]">Bokning demo</p>
          <h2 className="mt-1 text-2xl font-black">Boka hos Elias</h2>
        </div>
        <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-bold text-[#17452f]">Steg 1–3</span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {["Tjänst", "Tid", "Uppgifter"].map((step, index) => (
          <div key={step} className="rounded-2xl bg-[#f7f7f4] px-3 py-2 text-center text-xs font-bold text-[#344139]">
            {index + 1}. {step}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
          <h3 className="text-lg font-black">1. Välj tjänst</h3>
        </div>
        <div className="mt-4 grid gap-3">
          {featuredServices.map((service, index) => (
            <button
              key={service.name}
              className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 text-left ${index === selectedServiceIndex ? "border-[#17452f] bg-white shadow-sm" : "border-[#dfe5dd] bg-white"}`}
              onClick={() => setSelectedServiceIndex(index)}
              type="button"
            >
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
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
          <h3 className="text-lg font-black">2. Välj tid</h3>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {demoTimeSlots.map((slot) => (
            <button
              key={slot}
              className={`rounded-2xl px-3 py-3 text-sm font-black ${slot === selectedTime ? "bg-[#17452f] text-white shadow-sm" : "border border-[#dfe5dd] bg-white text-[#344139]"}`}
              onClick={() => setSelectedTime(slot)}
              type="button"
            >
              {slot}
            </button>
          ))}
        </div>
        <p className="mt-3 rounded-2xl bg-[#e7f1eb] px-3 py-2 text-xs font-bold text-[#17452f]">✓ Vald tid: {selectedTime}</p>
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
        <p className="mt-3 text-xs leading-5 text-[#5b665f]">Demo: frisören godkänner tiden i dashboarden. Kunden får sedan bekräftelse.</p>
      </div>
    </div>
  );
}
