import type { Metadata } from "next";
import { ArrowRight, CalendarCheck, Clock, MailCheck, MapPin, MessageSquareText, QrCode, Scissors, ShieldCheck, Star, UserCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { demoTimeSlots, juliusSalon, salonReviews, salonServices } from "@/lib/salon-demo";

export const metadata: Metadata = {
  title: "Julius Salong demo",
  description: "Demo av QR-bokning, tjänster, priser och bokningsflöde för Julius Salong i Södertälje.",
};

const bookingSteps = [
  { icon: QrCode, title: "1. Skanna QR-kod", text: "Kunden skannar QR-koden i salongen, på visitkortet eller från Instagram." },
  { icon: Scissors, title: "2. Välj tjänst", text: "Kunden ser tjänster, priser och ungefärlig behandlingstid innan bokning." },
  { icon: CalendarCheck, title: "3. Välj ledig tid", text: "Lediga tider visas tydligt och bokningen skapas som väntande." },
  { icon: UserCheck, title: "4. Frisören godkänner", text: "Elias får notis via e-post först. SMS kan läggas till som nästa steg." },
  { icon: MailCheck, title: "5. Kunden får bekräftelse", text: "När tiden godkänns skickas automatisk bekräftelse till kunden." },
] as const;

const faq = [
  { question: "Vad kostar en herrklippning?", answer: "Herrklippning kostar 299 kr och tar cirka 25 minuter." },
  { question: "Har ni studentpris?", answer: "Ja, herrklippning för studenter kostar 249 kr." },
  { question: "Hur bokar jag tid?", answer: "Välj tjänst, frisör och en ledig tid. När salongen bekräftar får du en bekräftelse." },
  { question: "Kan Proffera skicka SMS?", answer: "I första versionen används e-post. SMS-påminnelser kan läggas till i nästa steg." },
] as const;

export default function JuliusSalonDemoPage() {
  return (
    <div className="bg-[#f7f7f4] text-[#17201a]">
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
        <div>
          <p className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#17452f] shadow-sm ring-1 ring-[#dfe5dd]">
            Demo för salong • QR-bokning • Proffera
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {juliusSalon.name} – boka frisörtid snabbare online.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5b665f]">
            En modern bokningssida där kunden skannar QR-koden, ser tjänster, priser och lediga tider, bokar online och får bekräftelse efter att frisören godkänt tiden.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#boka">Testa bokningsflöde</ButtonLink>
            <ButtonLink href="#tjanster" variant="secondary">Se tjänster</ButtonLink>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]">
              <Star className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
              <p className="mt-2 text-2xl font-bold">{juliusSalon.rating}</p>
              <p className="text-sm text-[#5b665f]">{juliusSalon.reviewsCount} betyg</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]">
              <Clock className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
              <p className="mt-2 text-2xl font-bold">25 min</p>
              <p className="text-sm text-[#5b665f]">populär tjänst</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]">
              <MapPin className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
              <p className="mt-2 text-2xl font-bold">Centrum</p>
              <p className="text-sm text-[#5b665f]">Södertälje</p>
            </div>
          </div>
        </div>

        <div id="boka" className="rounded-3xl bg-white p-6 shadow-xl shadow-black/5 ring-1 ring-[#dfe5dd]">
          <div className="flex items-start justify-between gap-4 border-b border-[#dfe5dd] pb-5">
            <div>
              <p className="text-sm font-semibold text-[#17452f]">Live booking preview</p>
              <h2 className="mt-1 text-2xl font-bold">Boka tid hos Elias</h2>
            </div>
            <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Demo</span>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold">
              Välj tjänst
              <select className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] px-4 py-3 text-sm text-[#344139]">
                {salonServices.slice(0, 5).map((service) => (
                  <option key={service.name}>{service.name} – {service.price}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Välj frisör
              <select className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] px-4 py-3 text-sm text-[#344139]">
                <option>Elias</option>
              </select>
            </label>
            <div>
              <p className="text-sm font-semibold">Lediga tider idag</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {demoTimeSlots.map((slot) => (
                  <button key={slot} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] px-3 py-2 text-sm font-semibold text-[#344139] hover:border-[#17452f] hover:bg-[#eef5ef]" type="button">
                    {slot}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] px-4 py-3 text-sm" placeholder="Namn" />
              <input className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] px-4 py-3 text-sm" placeholder="Telefon" />
              <input className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] px-4 py-3 text-sm sm:col-span-2" placeholder="E-post" />
            </div>
            <button className="inline-flex items-center justify-center rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0e2e1e]" type="button">
              Skicka bokningsförfrågan <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </button>
            <p className="text-xs leading-5 text-[#5b665f]">
              Demo: bokningen får status "väntar på godkännande". Frisören godkänner i dashboarden och kunden får bekräftelse.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Bokningsflöde</p>
          <h2 className="mt-2 text-3xl font-bold">Så fungerar QR-bokningen</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {bookingSteps.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-5">
                <Icon className="h-7 w-7 text-[#17452f]" aria-hidden="true" />
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5b665f]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="tjanster" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Tjänster och priser</p>
            <h2 className="mt-2 text-3xl font-bold">Alla behandlingar på ett ställe</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#5b665f]">Kunden ser pris och tidsåtgång innan bokning, vilket minskar frågor via telefon och Instagram.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {salonServices.map((service) => (
            <article key={service.name} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#17452f]">{service.category}</p>
              <h3 className="mt-2 text-lg font-bold">{service.name}</h3>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="rounded-full bg-[#f7f7f4] px-3 py-1 font-semibold text-[#5b665f]">{service.duration}</span>
                <span className="text-xl font-bold text-[#17452f]">{service.price}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div className="rounded-3xl bg-[#17452f] p-8 text-white">
            <QrCode className="h-10 w-10" aria-hidden="true" />
            <h2 className="mt-5 text-3xl font-bold">QR-kod för salong, kort och Instagram</h2>
            <p className="mt-3 text-white/80">Skriv ut QR-koden och låt kunden boka direkt utan att ringa.</p>
            <div className="mt-8 flex h-48 w-48 items-center justify-center rounded-3xl bg-white text-center text-sm font-bold text-[#17452f]">
              QR<br />proffera.se/demo/julius-salong
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {salonReviews.map((review) => (
              <article key={review} className="rounded-3xl bg-[#fbfbf8] p-6 ring-1 ring-[#dfe5dd]">
                <div className="flex gap-1 text-[#17452f]" aria-label="5 stjärnor">
                  {Array.from({ length: 5 }).map((_, index) => <Star key={index} className="h-4 w-4 fill-current" aria-hidden="true" />)}
                </div>
                <p className="mt-4 text-sm leading-6 text-[#344139]">“{review}”</p>
              </article>
            ))}
            <article className="rounded-3xl bg-[#fbfbf8] p-6 ring-1 ring-[#dfe5dd]">
              <MapPin className="h-6 w-6 text-[#17452f]" aria-hidden="true" />
              <h3 className="mt-3 font-bold">{juliusSalon.address}</h3>
              <p className="mt-2 text-sm text-[#5b665f]">Google Maps kan bäddas in här när kunden godkänner demon.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h2 className="text-2xl font-bold">Öppettider</h2>
          <div className="mt-5 grid gap-3">
            {juliusSalon.openingHours.map((item) => (
              <div key={item.day} className="flex items-center justify-between rounded-2xl bg-[#f7f7f4] px-4 py-3 text-sm">
                <span className="font-semibold">{item.day}</span>
                <span className="text-[#5b665f]">{item.hours}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h2 className="text-2xl font-bold">FAQ / AI-svar</h2>
          <div className="mt-5 grid gap-3">
            {faq.map((item) => (
              <details key={item.question} className="rounded-2xl bg-[#f7f7f4] p-4">
                <summary className="cursor-pointer font-semibold">{item.question}</summary>
                <p className="mt-3 text-sm leading-6 text-[#5b665f]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#17201a] p-8 text-white md:p-10">
          <MessageSquareText className="h-10 w-10 text-[#e8b44d]" aria-hidden="true" />
          <h2 className="mt-5 text-3xl font-bold">Nästa steg efter demo</h2>
          <p className="mt-3 max-w-2xl text-white/75">Om Julius Salong godkänner demon kan sidan kopplas till egen domän och bokningsmotorn byggas vidare med riktiga e-postnotiser, SMS och admininloggning.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/dashboard/salon" variant="secondary">Visa dashboard-demo</ButtonLink>
            <ButtonLink href="/kontakt" variant="secondary">Kontakta Proffera</ButtonLink>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-white/70">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Byggd som demo under Proffera. Kundens egen domän kan kopplas senare.
          </div>
        </div>
      </section>
    </div>
  );
}
