import type { Metadata } from "next";
import { CalendarCheck, Clock3, Mail, Plus, Scissors, Settings, Smartphone, UserPlus, Users } from "lucide-react";
import { demoBookings, juliusSalon, salonServices } from "@/lib/salon-demo";

export const metadata: Metadata = {
  title: "Salon dashboard demo",
  description: "Dashboard-demo för salong med bokningar, tjänster, personal och öppettider.",
};

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

export default function SalonDashboardPage() {
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
          <p className="mt-3 text-3xl font-bold text-[#17452f]">1</p>
          <p className="mt-2 text-sm text-[#5b665f]">Behöver godkännas</p>
        </article>
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm font-semibold text-[#5b665f]">Bekräftade tider</p>
          <p className="mt-3 text-3xl font-bold text-[#17452f]">2</p>
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
          <div className="mt-6 grid gap-3">
            {demoBookings.map((booking) => (
              <article key={`${booking.customer}-${booking.time}`} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
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
                  <button className="rounded-full bg-[#17452f] px-4 py-2 text-xs font-bold text-white" type="button">Godkänn</button>
                  <button className="rounded-full border border-[#dfe5dd] bg-white px-4 py-2 text-xs font-bold text-[#344139]" type="button">Flytta tid</button>
                  <button className="rounded-full border border-[#dfe5dd] bg-white px-4 py-2 text-xs font-bold text-[#344139]" type="button">Meddelande</button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">Snabbinställningar</h3>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl bg-[#f7f7f4] p-4">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
                <p className="font-bold">Salongsinformation</p>
              </div>
              <p className="mt-2 text-sm text-[#5b665f]">Namn, adress, telefon, Instagram och bokningslänk.</p>
            </div>
            <div className="rounded-2xl bg-[#f7f7f4] p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
                <p className="font-bold">Personal</p>
              </div>
              <p className="mt-2 text-sm text-[#5b665f]">Lägg till ny frisör, e-post, telefon och arbetstider.</p>
            </div>
            <div className="rounded-2xl bg-[#f7f7f4] p-4">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
                <p className="font-bold">Öppettider</p>
              </div>
              <p className="mt-2 text-sm text-[#5b665f]">Styr tider per veckodag och blockera semester eller helgdagar.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h3 className="text-xl font-bold text-[#17201a]">Tjänster</h3>
            <p className="mt-1 text-sm text-[#5b665f]">Priser och tidsåtgång kan ändras av salongen.</p>
          </div>
          <button className="inline-flex w-fit items-center gap-2 rounded-full bg-[#17452f] px-4 py-2 text-sm font-semibold text-white" type="button">
            <Plus className="h-4 w-4" aria-hidden="true" /> Lägg till tjänst
          </button>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {salonServices.slice(0, 6).map((service) => (
            <article key={service.name} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#17452f]">{service.category}</p>
              <h4 className="mt-2 font-bold text-[#17201a]">{service.name}</h4>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-[#5b665f]">{service.duration}</span>
                <span className="font-bold text-[#17452f]">{service.price}</span>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="rounded-full border border-[#dfe5dd] bg-white px-3 py-1.5 text-xs font-bold" type="button">Redigera</button>
                <button className="rounded-full border border-[#dfe5dd] bg-white px-3 py-1.5 text-xs font-bold" type="button">Pausa</button>
              </div>
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
