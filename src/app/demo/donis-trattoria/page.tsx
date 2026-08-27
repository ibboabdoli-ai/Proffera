import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Globe2,
  Star,
} from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "Doni’s Trattoria – redesign concept by Proffera" },
  description: "Illustrativ redesign-demo för Doni’s Trattoria, framtagen av Proffera.",
  robots: { index: false, follow: false },
};

const dishes = [
  {
    name: "Fettuccine Doni’s",
    description: "Färsk fettuccine, kalvfilé, mascarpone, spenat & tryffelkräm.",
    price: "219 kr",
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Mare Mare",
    description: "Fior di latte, scampi, gröna musslor, chili, citron & vitlök.",
    price: "190 kr",
    image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Penne alla vodka",
    description: "Krämig tomatsås, mascarpone, nduja och parmesan.",
    price: "189 kr",
    image: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=85",
  },
];

const hours = [
  ["Mån–tors", "11:00–21:00"],
  ["Fredag", "11:00–22:00"],
  ["Lördag", "12:00–22:00"],
  ["Söndag", "12:00–21:00"],
];

export default function DonisTrattoriaDemoPage() {
  return (
    <div className="min-h-screen bg-[#f4efe5] text-[#191d19]">
      <div className="sticky top-0 z-50 border-b border-white/10 bg-[#131713]/95 px-4 py-2.5 text-white backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-white/65">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#dcbf7a] text-[#131713]">P</span>
            Proffera concept demo
          </div>
          <div className="text-[11px] font-semibold text-white/45">Illustrativ demo · inga riktiga bokningar skickas</div>
        </div>
      </div>

      <main>
        <section className="relative min-h-[860px] overflow-hidden bg-[#171b17] text-white">
          <img
            src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=2200&q=90"
            alt="Illustrativ italiensk restaurangmiljö"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,16,13,.97)_0%,rgba(13,16,13,.76)_47%,rgba(13,16,13,.18)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

          <div className="relative mx-auto flex min-h-[860px] max-w-[1480px] flex-col px-4 pb-14 pt-7 sm:px-6 lg:px-10">
            <header className="flex items-center justify-between rounded-full border border-white/15 bg-black/15 px-5 py-3 backdrop-blur-lg">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-[#dcbf7a]/70 bg-black/25 font-serif text-xl italic text-[#f0d490]">D</span>
                <div>
                  <p className="font-serif text-xl font-semibold leading-none">Doni’s Trattoria</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Hornsbergs Strand · Stockholm</p>
                </div>
              </div>
              <nav className="hidden items-center gap-7 text-sm font-bold text-white/72 lg:flex">
                <a href="#meny" className="hover:text-[#f0d490]">Meny</a>
                <a href="#erbjudande" className="hover:text-[#f0d490]">Erbjudande</a>
                <a href="#boka" className="hover:text-[#f0d490]">Boka bord</a>
                <a href="#kontakt" className="hover:text-[#f0d490]">Kontakt</a>
              </nav>
              <a href="#boka" className="rounded-full bg-[#dfbf76] px-5 py-2.5 text-sm font-black text-[#171b17] shadow-xl transition hover:-translate-y-0.5">Boka bord</a>
            </header>

            <div className="flex flex-1 items-end lg:items-center">
              <div className="max-w-3xl pb-8 lg:pb-0">
                <div className="mb-6 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
                    <Star className="h-3.5 w-3.5 fill-[#e6c77e] text-[#e6c77e]" /> 4,1 · 223 Google-omdömen
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">🌊 Vid vattnet på Kungsholmen</span>
                </div>
                <p className="text-xs font-black uppercase tracking-[0.26em] text-[#e6c77e] sm:text-sm">Italiensk matupplevelse · Hornsbergs Strand</p>
                <h1 className="mt-4 max-w-3xl font-serif text-5xl font-semibold leading-[.93] tracking-[-0.045em] sm:text-7xl lg:text-[92px]">
                  Italien känns
                  <span className="block italic text-[#f0d490]">lite närmare här.</span>
                </h1>
                <p className="mt-7 max-w-2xl text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
                  Vedugnsbakad pizza, färsk pasta och en varm trattoria-känsla precis vid Hornsbergs Strand. För lunch med kollegor, middag med familjen eller ett glas vin med vänner.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a href="#boka" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#dfbf76] px-6 py-3.5 text-sm font-black text-[#171b17] shadow-[0_18px_60px_rgba(223,191,118,.25)] transition hover:-translate-y-0.5">
                    Boka bord <ArrowRight className="h-4 w-4" />
                  </a>
                  <a href="#meny" className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/8 px-6 py-3.5 text-sm font-black backdrop-blur">Se menyn</a>
                </div>
                <div className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-xs font-semibold text-white/50 sm:text-sm">
                  <span>📍 Hornsbergs Strand 77</span>
                  <span>☎ 08-656 84 00</span>
                  <span>🍝 Italienskt · Pizza · Pasta</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-7 px-4 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[1320px] grid-cols-2 overflow-hidden rounded-[1.7rem] border border-black/5 bg-white shadow-[0_28px_80px_rgba(38,38,31,.13)] sm:grid-cols-4">
            {[
              ["📅", "Boka bord", "#boka"],
              ["🛍️", "Beställ online", "https://wolt.com/sv/swe/stockholm/restaurant/doni-trattoria-italiano"],
              ["☎️", "Ring oss", "tel:+4686568400"],
              ["📍", "Hitta hit", "https://www.google.com/maps/search/?api=1&query=Hornsbergs+Strand+77+Stockholm"],
            ].map(([icon, label, href], index) => (
              <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className={`group flex items-center gap-3 p-5 transition hover:bg-[#f7f0df] ${index < 3 ? "sm:border-r sm:border-black/5" : ""} ${index < 2 ? "border-b border-black/5 sm:border-b-0" : ""}`}>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1a201b] text-lg">{icon}</span>
                <div>
                  <p className="text-sm font-black">{label}</p>
                  <p className="mt-0.5 hidden text-[11px] font-semibold text-[#777c76] sm:block">Snabbt & enkelt</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="meny" className="mx-auto max-w-[1480px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#96712f]">Smaker att längta tillbaka till</p>
              <h2 className="mt-3 font-serif text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">Favoriter från köket</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Populärt", "Pizza", "Pasta", "Kött", "Vegetariskt"].map((item, index) => (
                <span key={item} className={`rounded-full px-4 py-2 text-xs font-black ${index === 0 ? "bg-[#1a201b] text-white" : "border border-[#d7d0c4] bg-white/55 text-[#565d57]"}`}>{item}</span>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {dishes.map((dish, index) => (
              <article key={dish.name} className="group overflow-hidden rounded-[2rem] bg-[#1a201b] text-white shadow-[0_20px_70px_rgba(35,35,29,.1)]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={dish.image} alt={`Illustrativ bild för ${dish.name}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#1a201b]">{index === 0 ? "Doni’s val" : "Populärt"}</span>
                </div>
                <div className="p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h3 className="font-serif text-2xl font-semibold">{dish.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/55">{dish.description}</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-[#f0d490]">{dish.price}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#172018] px-4 py-20 text-white sm:px-6 lg:px-10 lg:py-24">
          <div className="mx-auto grid max-w-[1480px] gap-6 lg:grid-cols-[1.05fr_.95fr]">
            <div className="relative min-h-[590px] overflow-hidden rounded-[2.4rem]">
              <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=88" alt="Illustrativ restaurangupplevelse" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 sm:p-10">
                <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-bold backdrop-blur">🌊 Hornsbergs Strand</span>
                <h2 className="mt-5 max-w-2xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">Middag vid vattnet. Utan att lämna stan.</h2>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-[2.4rem] bg-[#f1e8d7] p-8 text-[#1b201c] sm:p-10 lg:p-12">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#98712f]">Ny webbupplevelse</p>
                <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.03] tracking-[-0.035em] sm:text-5xl">Mindre generisk text. Mer Doni’s.</h2>
                <p className="mt-6 text-base leading-8 text-[#606761]">Den nya sidan lyfter restaurangens verkliga styrkor: italienska smaker, läget vid vattnet och tydliga vägar till bokning, beställning och kontakt.</p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {["Färsk pasta", "Vedugnsbakad pizza", "Uteservering", "Lunch & middag"].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/65 px-4 py-3 text-sm font-black"><CheckCircle2 className="h-4 w-4 text-[#8d6c33]" />{item}</div>
                  ))}
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7">
                  <div className="flex gap-1 text-[#e7ca89]">{[1,2,3,4,5].map((i) => <Star key={i} className="h-4 w-4 fill-current" />)}</div>
                  <p className="mt-5 font-serif text-2xl font-semibold">Google-omdömen får en tydlig plats.</p>
                  <p className="mt-3 text-sm leading-6 text-white/45">Social proof direkt där gästen bestämmer sig.</p>
                </div>
                <div className="rounded-[2rem] bg-[#d9b86d] p-7 text-[#1b201c]">
                  <Globe2 className="h-6 w-6" />
                  <p className="mt-5 font-serif text-2xl font-semibold">Mobil först.</p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-black/55">Boka, beställ och ring med ett tryck.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="erbjudande" className="mx-auto max-w-[1480px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <div className="overflow-hidden rounded-[2.5rem] bg-[#d8b66a] shadow-[0_32px_100px_rgba(155,111,31,.15)]">
            <div className="grid lg:grid-cols-[.9fr_1.1fr]">
              <div className="p-8 sm:p-12 lg:p-16">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#1b201c] px-3.5 py-2 text-xs font-black uppercase tracking-[0.13em] text-white">🎁 Proffera-erbjudande</span>
                <h2 className="mt-6 max-w-xl font-serif text-5xl font-semibold leading-[.98] tracking-[-0.04em] sm:text-6xl">20% på pasta varje tisdag.</h2>
                <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-black/58">Exempel på hur Doni’s kan skapa ett erbjudande i Proffera och visa samma kampanj på webbplatsen, Proffera-profilen och i ett e-postutskick.</p>
                <div className="mt-8 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/50 px-4 py-2 text-xs font-black">Gäller tisdagar</span>
                  <span className="rounded-full bg-white/50 px-4 py-2 text-xs font-black">På plats</span>
                  <span className="rounded-full bg-white/50 px-4 py-2 text-xs font-black">Demoerbjudande</span>
                </div>
              </div>
              <div className="relative min-h-[440px] overflow-hidden bg-[#1b201c]">
                <img src="https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1600&q=90" alt="Illustrativ pasta" className="absolute inset-0 h-full w-full object-cover opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#1b201c]/75 via-transparent to-transparent" />
                <div className="absolute bottom-8 right-8 w-[280px] rounded-[1.5rem] bg-white/92 p-5 text-[#1b201c] shadow-2xl backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8b672b]">Synkat via Proffera</p>
                  <p className="mt-2 text-lg font-black">Kampanj publicerad</p>
                  <div className="mt-4 space-y-2 text-xs font-bold text-[#616761]">
                    {['Webbsida','Proffera-profil','E-postkampanj'].map((item) => <p key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#387454]" />{item}</p>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="boka" className="bg-[#ebe3d6] px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
          <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[.84fr_1.16fr]">
            <div className="rounded-[2.3rem] bg-[#1b201c] p-8 text-white sm:p-10 lg:p-12">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e7ca89]">Boka bord</p>
              <h2 className="mt-4 font-serif text-5xl font-semibold leading-none tracking-[-0.04em]">En bokning som känns lika enkel som ett sms.</h2>
              <p className="mt-5 text-base leading-7 text-white/55">Nuvarande bokningslösning kan kopplas in. Demon visar hur upplevelsen kan se ut på den nya webbplatsen.</p>
              <div className="mt-8 space-y-3 text-sm font-bold text-white/68">
                {['Mobilanpassat bokningsflöde','Bekräftelse och påminnelse','Koppling till kundlista i Proffera'].map((item) => <p key={item} className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-[#e7ca89]" />{item}</p>)}
              </div>
            </div>

            <div className="rounded-[2.3rem] border border-black/5 bg-white p-6 shadow-[0_25px_90px_rgba(42,42,35,.08)] sm:p-8 lg:p-10">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Datum", "Välj datum", "📅"],
                  ["Tid", "19:00", "🕒"],
                  ["Antal gäster", "2 gäster", "👥"],
                  ["Kontakt", "Ditt namn & mobil", "✉️"],
                ].map(([label, value, icon]) => (
                  <div key={label}>
                    <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#727872]">{label}</p>
                    <div className="flex min-h-13 items-center justify-between rounded-2xl border border-[#ddd9d0] bg-[#fbfaf7] px-4 py-3.5 text-sm font-bold"><span>{value}</span><span>{icon}</span></div>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1b201c] px-5 py-4 text-sm font-black text-white">Visa lediga bord <ArrowRight className="h-4 w-4 text-[#e7ca89]" /></button>
              <p className="mt-3 text-center text-[11px] font-semibold text-[#8a8e89]">Demoläge – ingen riktig bokning skickas.</p>
            </div>
          </div>
        </section>

        <section id="kontakt" className="mx-auto max-w-[1480px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#96712f]">Hitta till oss</p>
              <h2 className="mt-3 font-serif text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">Hornsbergs Strand 77</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#666d67]">Precis vid vattnet på Kungsholmen, Stockholm. Kom för lunchen. Stanna för utsikten.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <a href="tel:+4686568400" className="rounded-2xl border border-[#d9d1c4] bg-white/55 p-4 text-sm font-black">☎ 08-656 84 00</a>
                <a href="mailto:donistrattoria@gmail.com" className="rounded-2xl border border-[#d9d1c4] bg-white/55 p-4 text-sm font-black">✉ donistrattoria@gmail.com</a>
              </div>
              <div className="mt-8 rounded-[2rem] bg-[#1a201b] p-7 text-white">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#e7ca89]">Öppettider</p>
                <div className="mt-5 divide-y divide-white/8">
                  {hours.map(([day,time]) => <div key={day} className="flex items-center justify-between py-3 text-sm"><span className="font-bold text-white/58">{day}</span><span className="font-black">{time}</span></div>)}
                </div>
              </div>
            </div>

            <div className="relative min-h-[600px] overflow-hidden rounded-[2.5rem] bg-[linear-gradient(135deg,#c9c0af,#e8dfcf)]">
              <div className="absolute left-[12%] top-[20%] h-[2px] w-[75%] rotate-[18deg] bg-white/65" />
              <div className="absolute left-[18%] top-[48%] h-[2px] w-[65%] -rotate-[21deg] bg-white/55" />
              <div className="absolute left-[8%] top-[72%] h-[2px] w-[82%] rotate-[7deg] bg-white/55" />
              <div className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#1a201b] text-3xl shadow-2xl">📍</div>
              <div className="absolute bottom-7 left-7 right-7 rounded-[1.5rem] bg-white/88 p-5 shadow-xl backdrop-blur sm:left-auto sm:w-80">
                <p className="text-xs font-black uppercase tracking-[0.13em] text-[#8d682c]">Kungsholmen</p>
                <p className="mt-1 text-lg font-black">Hornsbergs Strand 77</p>
                <a href="https://www.google.com/maps/search/?api=1&query=Hornsbergs+Strand+77+Stockholm" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#315c45]">Öppna i Google Maps <ArrowRight className="h-4 w-4" /></a>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#101410] px-4 py-16 text-white sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[1480px] gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d7b46a]/25 bg-[#d7b46a]/8 px-3 py-1.5 text-xs font-black text-[#e7ca89]">✨ Powered by Proffera</div>
              <h2 className="mt-5 max-w-3xl font-serif text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-5xl">Webbplats, erbjudanden, kundkontakt och uppföljning – i ett flöde.</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/48">Demon visar hur Doni’s kan få en starkare webb samtidigt som erbjudanden, kundkontakt, kampanjer och analys kopplas till Proffera.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["🎁","Erbjudanden"],
                ["✉️","E-postkampanjer"],
                ["💬","Kundförfrågningar"],
                ["📊","Omdömen & analys"],
              ].map(([icon,label]) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 p-4 text-sm font-black"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d7b46a]/10">{icon}</span>{label}</div>)}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 bg-[#0c0f0d] px-4 py-8 text-white sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-xl font-semibold">Doni’s Trattoria</p>
            <p className="mt-1 text-xs font-semibold text-white/35">Redesign concept demo by Proffera · Bilder i demon är illustrativa.</p>
          </div>
          <a href="https://www.proffera.se" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-[#e7ca89]">proffera.se <ArrowRight className="h-4 w-4" /></a>
        </div>
      </footer>
    </div>
  );
}
