"use client";

import type { ReactNode } from "react";
import { Clock, MapPin, QrCode, Star } from "lucide-react";
import { BookingWidget } from "@/components/salon/booking-widget";
import { juliusSalon, salonReviews, salonServices } from "@/lib/salon-demo";

type JuliusBookingDemoProps = {
  bookingContent?: ReactNode;
  live?: boolean;
};

export function JuliusBookingDemo({ bookingContent, live = false }: JuliusBookingDemoProps) {
  const popularServices = salonServices.slice(0, 3);

  return (
    <div className="bg-[#f7f7f4] pb-24 text-[#17201a] lg:pb-0">
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-14">
        <div className="rounded-[2rem] bg-[#17201a] p-5 text-white shadow-xl shadow-black/10 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 lg:p-8">
          <div>
            <p className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/85 ring-1 ring-white/15">
              {live ? "Boka online • Julius Salong" : "Demo • QR-bokning • Proffera"}
            </p>
            <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{juliusSalon.name}</h1>
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
              <a className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 shadow-sm ring-1 ring-white hover:bg-[#f3f5f1]" href="#boka">
                <span className="!text-[#17201a] text-sm font-black">Boka tid</span>
              </a>
              <a className="inline-flex items-center justify-center rounded-full border border-white/70 bg-transparent px-5 py-3 hover:bg-white/10" href="#tjanster">
                <span className="!text-white text-sm font-black">Populära priser</span>
              </a>
            </div>
          </div>

          <div id="boka">
            {bookingContent ?? <BookingWidget />}
          </div>
        </div>
      </section>

      <section id="tjanster" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#17452f]">Populära tjänster</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Priser före bokning</h2>
          </div>
          <span className="hidden rounded-full bg-white px-4 py-2 text-sm font-bold text-[#17452f] ring-1 ring-[#dfe5dd] sm:block">Fler tjänster finns i bokningen</span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {popularServices.map((service) => (
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
            <h2 className="mt-4 text-2xl font-black">Skanna och boka direkt</h2>
            <p className="mt-2 text-sm leading-6 text-white/75">QR-koden kan sättas på spegeln, disken, visitkortet eller Instagram.</p>
            <div className="mt-6 flex h-44 w-44 items-center justify-center rounded-3xl bg-white text-center text-sm font-black text-[#17452f]">
              QR<br />Julius Salong
            </div>
            <p className="mt-4 break-all text-xs font-bold text-white/70">{live ? "proffera.se/boka/julius-salong" : "julius.proffera.se"}</p>
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
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">Nedre Torekällgatan 5, nära Södertälje centrum.</p>
          <div className="mt-5 rounded-3xl bg-[#f7f7f4] p-5 text-sm font-bold text-[#17452f]">Södertälje centrum • Nära kunderna</div>
        </div>
      </section>

      {!live ? <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#17201a] p-6 text-white md:p-8">
          <h2 className="text-2xl font-black">Vill du använda detta i din salong?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Vi visar hur flödet kan anpassas med bokning, bekräftelser, påminnelser och egen webbadress för din salong.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <a className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 shadow-sm ring-2 ring-white hover:bg-[#f3f5f1] focus:outline-none focus:ring-2 focus:ring-[#e8b44d] focus:ring-offset-2 focus:ring-offset-[#17201a]" href="/kontakt">
              <span className="!text-[#17201a] text-sm font-black">Kontakta Proffera</span>
            </a>
          </div>
        </div>
      </section> : null}

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
