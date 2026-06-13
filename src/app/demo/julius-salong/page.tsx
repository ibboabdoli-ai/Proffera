import type { Metadata } from "next";
import { ArrowRight, CalendarCheck, Clock, MapPin, QrCode, Scissors, Star, UserCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { demoTimeSlots, juliusSalon, salonReviews, salonServices } from "@/lib/salon-demo";

export const metadata: Metadata = {
  title: "Julius Salong demo",
  description: "Mobile-first demo av QR-bokning, tjänster, priser och bokningsflöde för Julius Salong i Södertälje.",
};

const featuredServices = salonServices.slice(0, 4);
const steps = ["Tjänst", "Tid", "Uppgifter"] as const;

export default function JuliusSalonDemoPage() {
  return (
    <div className="bg-[#f7f7f4] pb-24 text-[#17201a] lg:pb-0">
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-14">
        <div className="rounded-[2rem] bg-[#17201a] p-5 text-white shadow-xl shadow-black/10 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 lg:p-8">
          <div>
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/85 ring-1 ring-white/15">
              Demo • QR-bokning • Proffera
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
              {juliusSalon.name}
            </h1>
            <p className="mt-2 text-base font-semibold text-[#e8b44d]">{juliusSalon.category}</p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 lg:text-base">
              Kunden skannar QR-koden, väljer tjänst och tid, skickar bokningsförfrågan och får bekräftelse när frisören godkänner.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <Star className="h-4 w-4 text-[#e8b44d]" aria-hidden="true" />
                <p className="mt-2 text-lg font-black">5/5</p>
                <p className="text-[11px] text-white/65">92 betyg</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <Clock className="h-4 w-4 text-[#e8b44d]" aria-hidden="true" />
                <p className="mt-2 text-lg font-black">25 min</p>
                <p className="text-[11px] text-white/65">från 299 kr</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                <MapPin className="h-4 w-4 text-[#e8b44d]" aria-hidden="true" />
                <p className="mt-2 text-lg font-black">Centrum</p>
                <p className="text-[11px] text-white/65">Södertälje</p>
              </div>
            </div>
            <div className="mt-5 hidden gap-3 sm:flex">
              <ButtonLink href="#boka" variant="secondary">Boka tid</ButtonLink>
              <ButtonLink href="#tjanster" variant="secondary">Se priser</ButtonLink>
            </div>
          </div>

          <div id="boka" className="mt-6 rounded-[1.7rem] bg-white p-4 text-[#17201a] shadow-2xl lg:mt-0 lg:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#17452f]">Bokning demo</p>
                <h2 className="mt-1 text-2xl font-black">Boka hos Elias</h2>
              </div>
              <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-bold text-[#17452f]">Steg 1–3</span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {steps.map((step, index) => (
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
                  <label key={service.name} className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 ${index === 0 ? "border-[#17452f] bg-white shadow-sm" : "border-[#dfe5dd] bg-white"}`}>
                    <span>
                      <span className="block text-sm font-black">{service.name}</span>
                      <span className="mt-1 block text-xs font-semibold text-[#5b665f]">{service.duration}</span>
                    </span>
                    <span className="text-base font-black text-[#17452f]">{service.price}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
                <h3 className="text-lg font-black">2. Välj tid</h3>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {demoTimeSlots.map((slot, index) => (
                  <button key={slot} className={`rounded-2xl px-3 py-3 text-sm font-black ${index === 4 ? "bg-[#17452f] text-white shadow-sm" : "border border-[#dfe5dd] bg-white text-[#344139]"}`} type="button">
                    {slot}
                  </button>
                ))}
              </div>
              <p className="mt-3 rounded-2xl bg-[#e7f1eb] px-3 py-2 text-xs font-bold text-[#17452f]">✓ Vald tid: 14:30</p>
            </div>

            <div className="mt-4 rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
                <h3 className="text-lg font-black">3. Dina uppgifter</h3>
              </div>
              <div className="mt-4 grid gap-3">
                <input className="rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base" placeholder="Namn" />
                <input className="rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base" placeholder="Telefon" />
                <input className="rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 text-base" placeholder="E-post" />
              </div>
              <button className="mt-4 flex w-full items-center justify-center rounded-full bg-[#17452f] px-5 py-4 text-base font-black text-white shadow-lg shadow-[#17452f]/20" type="button">
                Skicka bokningsförfrågan <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </button>
              <p className="mt-3 text-xs leading-5 text-[#5b665f]">Demo: frisören godkänner tiden i dashboarden. Kunden får sedan bekräftelse.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="tjanster" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#17452f]">Tjänster och priser</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Välj behandling</h2>
          </div>
          <span className="hidden rounded-full bg-white px-4 py-2 text-sm font-bold text-[#17452f] ring-1 ring-[#dfe5dd] sm:block">Alla priser visas före bokning</span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {salonServices.map((service) => (
            <article key={service.name} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#17452f]">{service.category}</p>
              <h3 className="mt-2 text-base font-black">{service.name}</h3>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="rounded-full bg-[#f7f7f4] px-3 py-1 font-bold text-[#5b665f]">{service.duration}</span>
                <span className="text-lg font-black text-[#17452f]">{service.price}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white py-10">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div className="rounded-3xl bg-[#17452f] p-6 text-white lg:col-span-1">
            <QrCode className="h-9 w-9" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-black">QR-bokning</h2>
            <p className="mt-2 text-sm leading-6 text-white/75">Sätt QR-koden på spegeln, disken, visitkortet eller Instagram.</p>
            <div className="mt-6 flex h-40 w-40 items-center justify-center rounded-3xl bg-white text-center text-sm font-black text-[#17452f]">
              QR<br />Demo-link
            </div>
          </div>
          <div className="grid gap-4 lg:col-span-2">
            {salonReviews.map((review) => (
              <article key={review} className="rounded-3xl bg-[#fbfbf8] p-5 ring-1 ring-[#dfe5dd]">
                <div className="flex gap-1 text-[#17452f]" aria-label="5 stjärnor">
                  {Array.from({ length: 5 }).map((_, index) => <Star key={index} className="h-4 w-4 fill-current" aria-hidden="true" />)}
                </div>
                <p className="mt-3 text-sm leading-6 text-[#344139]">“{review}”</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
          <h2 className="text-xl font-black">Öppettider</h2>
          <div className="mt-4 grid gap-2">
            {juliusSalon.openingHours.map((item) => (
              <div key={item.day} className="flex items-center justify-between rounded-2xl bg-[#f7f7f4] px-4 py-3 text-sm">
                <span className="font-bold">{item.day}</span>
                <span className="text-[#5b665f]">{item.hours}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
          <h2 className="text-xl font-black">Plats</h2>
          <p className="mt-3 text-sm font-bold text-[#344139]">{juliusSalon.address}</p>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">Google Maps kan kopplas in när kunden godkänner demon.</p>
          <div className="mt-5 rounded-3xl bg-[#f7f7f4] p-5 text-sm font-bold text-[#17452f]">Södertälje centrum • Nära kunderna</div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#17201a] p-6 text-white md:p-8">
          <h2 className="text-2xl font-black">Nästa steg efter demo</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Om Julius Salong godkänner demon kan lösningen byggas vidare med riktig bokningsdatabas, e-postnotiser, SMS och egen domän.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/dashboard/salon" variant="secondary">Visa dashboard-demo</ButtonLink>
            <ButtonLink href="/kontakt" variant="secondary">Kontakta Proffera</ButtonLink>
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#dfe5dd] bg-white/95 p-3 shadow-2xl backdrop-blur lg:hidden">
        <a href="#boka" className="flex items-center justify-between rounded-full bg-[#17452f] px-5 py-4 text-white shadow-lg shadow-[#17452f]/20">
          <span>
            <span className="block text-xs font-bold text-white/70">Julius Salong</span>
            <span className="block text-sm font-black">Boka tid online</span>
          </span>
          <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-[#17452f]">Från 299 kr</span>
        </a>
      </div>
    </div>
  );
}
