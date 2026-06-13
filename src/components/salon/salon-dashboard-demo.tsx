"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, Clock3, Mail, Plus, Scissors, Settings, Smartphone, UserPlus, Users } from "lucide-react";
import { type SalonBooking, readStoredSalonBookings, writeStoredSalonBookings } from "@/components/salon/booking-widget";
import { demoBookings, juliusSalon, salonServices } from "@/lib/salon-demo";

const modules = [
  { icon: CalendarCheck, title: "Bokningar", text: "Se väntande och bekräftade tider." },
  { icon: Scissors, title: "Tjänster", text: "Ändra pris, tidsåtgång och aktiva tjänster." },
  { icon: UserPlus, title: "Personal", text: "Lägg till frisörer och koppla tjänster till rätt person." },
  { icon: Clock3, title: "Öppettider", text: "Ställ in veckoschema, raster och stängda dagar." },
  { icon: Mail, title: "E-post", text: "Skicka bokningsförfrågan och bekräftelse automatiskt." },
  { icon: Smartphone, title: "SMS nästa steg", text: "SMS-påminnelser kan kopplas på senare." },
] as const;

const statusClasses = {
  pending: "bg-[#fff6dd] text-[#8a5b00]",
  confirmed: "bg-[#e7f1eb] text-[#17452f]",
  cancelled: "bg-[#ffe9e9] text-[#9a1c1c]",
} as const;

function statusLabel(status: SalonBooking["status"]) {
  if (status === "confirmed") return "Bekräftad";
  if (status === "cancelled") return "Avbokad";
  return "Väntar på godkännande";
}

export function SalonDashboardDemo() {
  const [bookings, setBookings] = useState<SalonBooking[]>([]);

  useEffect(() => {
    function syncBookings() {
      setBookings(readStoredSalonBookings());
    }

    syncBookings();
    window.addEventListener("storage", syncBookings);
    window.addEventListener("proffera-salon-bookings-updated", syncBookings);

    return () => {
      window.removeEventListener("storage", syncBookings);
      window.removeEventListener("proffera-salon-bookings-updated", syncBookings);
    };
  }, []);

  const visibleBookings = useMemo(() => {
    const stored = bookings.map((booking) => ({
      id: booking.id,
      customer: booking.customerName,
      service: booking.serviceName,
      time: booking.time,
      status: statusLabel(booking.status),
      statusTone: booking.status,
      stored: true,
    }));

    const fallback = demoBookings.map((booking) => ({
      id: `${booking.customer}-${booking.time}`,
      customer: booking.customer,
      service: booking.service,
      time: booking.time,
      status: booking.status,
      statusTone: booking.statusTone,
      stored: false,
    }));

    return stored.length > 0 ? stored : fallback;
  }, [bookings]);

  const pendingCount = visibleBookings.filter((booking) => booking.statusTone === "pending").length;
  const confirmedCount = visibleBookings.filter((booking) => booking.statusTone === "confirmed").length;

  function updateBookingStatus(id: string, status: SalonBooking["status"]) {
    const next = bookings.map((booking) => (booking.id === id ? { ...booking, status } : booking));
    setBookings(next);
    writeStoredSalonBookings(next);
  }

  return (
    <div className="grid gap-8">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Salon MVP</p>
          <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Dashboard för {juliusSalon.name}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
            Demo av hur Elias kan hantera bokningar, tjänster, personal och öppettider från Proffera utan att röra kod.
          </p>
        </div>
        <div className="rounded-full bg-[#e7f1eb] px-4 py-2 text-sm font-semibold text-[#17452f]">Demo tenant: julius-salong</div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm font-semibold text-[#5b665f]">Väntande bokningar</p>
          <p className="mt-3 text-3xl font-bold text-[#17452f]">{pendingCount}</p>
          <p className="mt-2 text-sm text-[#5b665f]">Behöver godkännas</p>
        </article>
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm font-semibold text-[#5b665f]">Bekräftade tider</p>
          <p className="mt-3 text-3xl font-bold text-[#17452f]">{confirmedCount}</p>
          <p className="mt-2 text-sm text-[#5b665f]">Kommande bokningar</p>
        </article>
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm font-semibold text-[#5b665f]">Aktiva tjänster</p>
          <p className="mt-3 text-3xl font-bold text-[#17452f]">{salonServices.length}</p>
          <p className="mt-2 text-sm text-[#5b665f]">Synliga på bokningssidan</p>
        </article>
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm font-semibold text-[#5b665f]">Personal</p>
          <p className="mt-3 text-3xl font-bold text-[#17452f]">1</p>
          <p className="mt-2 text-sm text-[#5b665f]">Elias aktiv</p>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-[#17201a]">Bokningar</h3>
              <p className="mt-1 text-sm text-[#5b665f]">Frisören kan godkänna eller flytta tider.</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-full bg-[#17452f] px-4 py-2 text-sm font-semibold text-white" type="button">
              <Plus className="h-4 w-4" aria-hidden="true" /> Ny bokning
            </button>
          </div>

          {bookings.length > 0 ? (
            <p className="mt-4 rounded-2xl bg-[#e7f1eb] px-4 py-3 text-sm font-bold text-[#17452f]">
              Live demo: bokningar från formuläret visas här i samma webbläsare.
            </p>
          ) : (
            <p className="mt-4 rounded-2xl bg-[#f7f7f4] px-4 py-3 text-sm font-bold text-[#5b665f]">
              Skapa en testbokning på demosidan för att se den här.
            </p>
          )}

          <div className="mt-6 grid gap-3">
            {visibleBookings.map((booking) => (
              <article key={booking.id} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <p className="font-bold text-[#17201a]">{booking.customer}</p>
                    <p className="mt-1 text-sm text-[#5b665f]">{booking.service} • {booking.time}</p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${statusClasses[booking.statusTone]}`}>
                    {booking.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="rounded-full bg-[#17452f] px-4 py-2 text-xs font-bold text-white disabled:bg-[#9aa89f]" disabled={!booking.stored} onClick={() => updateBookingStatus(booking.id, "confirmed")} type="button">Godkänn</button>
                  <button className="rounded-full border border-[#dfe5dd] bg-white px-4 py-2 text-xs font-bold text-[#344139] disabled:text-[#9aa89f]" disabled={!booking.stored} onClick={() => updateBookingStatus(booking.id, "cancelled")} type="button">Avboka</button>
                  <button className="rounded-full border border-[#dfe5dd] bg-white px-4 py-2 text-xs font-bold text-[#344139]" type="button">Meddelande</button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">Snabbinställningar</h3>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl bg-[#f7f7f4] p-4"><Settings className="h-5 w-5 text-[#17452f]" aria-hidden="true" /><p className="mt-2 font-bold">Salongsinformation</p><p className="mt-2 text-sm text-[#5b665f]">Namn, adress, telefon, Instagram och bokningslänk.</p></div>
            <div className="rounded-2xl bg-[#f7f7f4] p-4"><Users className="h-5 w-5 text-[#17452f]" aria-hidden="true" /><p className="mt-2 font-bold">Personal</p><p className="mt-2 text-sm text-[#5b665f]">Lägg till ny frisör, e-post, telefon och arbetstider.</p></div>
            <div className="rounded-2xl bg-[#f7f7f4] p-4"><Clock3 className="h-5 w-5 text-[#17452f]" aria-hidden="true" /><p className="mt-2 font-bold">Öppettider</p><p className="mt-2 text-sm text-[#5b665f]">Styr tider per veckodag och blockera semester eller helgdagar.</p></div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h3 className="text-xl font-bold text-[#17201a]">Tjänster</h3>
            <p className="mt-1 text-sm text-[#5b665f]">Priser och tidsåtgång kan ändras av salongen.</p>
          </div>
          <button className="inline-flex w-fit items-center gap-2 rounded-full bg-[#17452f] px-4 py-2 text-sm font-semibold text-white" type="button"><Plus className="h-4 w-4" aria-hidden="true" /> Lägg till tjänst</button>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {salonServices.slice(0, 6).map((service) => (
            <article key={service.name} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#17452f]">{service.category}</p>
              <h4 className="mt-2 font-bold text-[#17201a]">{service.name}</h4>
              <div className="mt-3 flex items-center justify-between text-sm"><span className="text-[#5b665f]">{service.duration}</span><span className="font-bold text-[#17452f]">{service.price}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <Icon className="h-7 w-7 text-[#17452f]" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-bold text-[#17201a]">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#5b665f]">{text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
