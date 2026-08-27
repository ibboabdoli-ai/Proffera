import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Gift,
  Instagram,
  Mail,
  MapPin,
  Menu as MenuIcon,
  MessageCircleMore,
  Phone,
  ShoppingBag,
  Sparkles,
  Star,
  UtensilsCrossed,
  Waves,
} from "lucide-react";

export const metadata: Metadata = {
  title: {
    absolute: "Doni’s Trattoria – redesign concept by Proffera",
  },
  description:
    "Ett illustrativt redesign-koncept för Doni’s Trattoria på Hornsbergs Strand, framtaget som kunddemo av Proffera.",
  robots: {
    index: false,
    follow: false,
  },
};

const menuItems = [
  {
    name: "Fettuccine Doni’s",
    text: "Färsk fettuccine, kalvfilé, mascarpone, spenat & tryffelkräm.",
    price: "219 kr",
    image:
      "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Mare Mare",
    text: "Fior di latte, scampi, gröna musslor, chili, citron & vitlök.",
    price: "190 kr",
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=85",
  },
  {
    name: "Penne alla vodka",
    text: "Krämig tomatsås, mascarpone, nduja och parmesan.",
    price: "189 kr",
    image:
      "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=85",
  },
];

const hours = [
  ["Måndag", "11:00–21:00"],
  ["Tisdag", "11:00–21:00"],
  ["Onsdag", "11:00–21:00"],
  ["Torsdag", "11:00–21:00"],
  ["Fredag", "11:00–22:00"],
  ["Lördag", "12:00–22:00"],
  ["Söndag", "12:00–21:00"],
];

const quickActions = [
  { icon: CalendarDays, label: "Boka bord", href: "#boka" },
  {
    icon: ShoppingBag,
    label: "Beställ online",
    href: "https://wolt.com/sv/swe/stockholm/restaurant/doni-trattoria-italiano",
  },
  { icon: Phone, label: "Ring oss", href: "tel:+4686568400" },
  {
    icon: MapPin,
    label: "Hitta hit",
    href: "https://www.google.com/maps/search/?api=1&query=Hornsbergs+Strand+77+Stockholm",
  },
];

export default function DonisTrattoriaDemoPage() {
  return (
    <div className="min-h-screen bg-[#f3efe7] text-[#1c211d] selection:bg-[#d7b46a] selection:text-[#1c211d]">
      <div className="sticky top-0 z-50 border-b border-white/10 bg-[#171b17]/95 px-4 py-2.5 text-white backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-white/70">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#d7b46a] text-[#171b17]">
              P
            </span>
            Proffera concept demo
          </div>
          <div className="hidden items-center gap-2 text-xs font-semibold text-white/55 sm:flex">
            <Sparkles className="h-3.5 w-3.5 text-[#d7b46a]" />
            Illustrativ redesign – inga bokningar skickas
          </div>
        </div>
      </div>

      <header className="absolute left-0 right-0 top-[49px] z-40 px-4 py-5 text-white sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between rounded-full border border-white/15 bg-black/15 px-5 py-3 backdrop-blur-md lg:px-7">
          <a href="#top" className="flex items-center gap-3" aria-label="Doni's Trattoria">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-[#d7b46a]/70 bg-[#171b17]/70 font-serif text-lg italic text-[#e8c77f]">
              D
            </span>
            <div>
              <p className="font-serif text-lg font-semibold leading-none tracking-tight sm:text-xl">Doni’s Trattoria</p>
              <p className="mt-1 hidden text-[10px] font-bold uppercase tracking-[0.19em] text-white/55 sm:block">Hornsbergs Strand · Stockholm</p>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-white/80 lg:flex">
            <a className="transition hover:text-[#e8c77f]" href="#meny">Meny</a>
            <a className="transition hover:text-[#e8c77f]" href="#upplevelse">Om Doni’s</a>
            <a className="transition hover:text-[#e8c77f]" href="#erbjudande">Erbjudanden</a>
            <a className="transition hover:text-[#e8c77f]" href="#kontakt">Kontakt</a>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href="#boka"
              className="hidden rounded-full bg-[#e2bf73] px-5 py-2.5 text-sm font-black text-[#1b201c] shadow-[0_12px_35px_rgba(226,191,115,.22)] transition hover:-translate-y-0.5 hover:bg-[#f0cf86] sm:inline-flex"
            >
              Boka bord
            </a>
            <a
              href="#meny"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 lg:hidden"
              aria-label="Visa meny"
            >
              <MenuIcon className="h-5 w-5" />
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="relative min-h-[820px] overflow-hidden bg-[#151915] text-white lg:min-h-[880px]">
          <img
            src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=2200&q=90"
            alt="Illustrativ restaurangmiljö"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(13,17,14,.96)_0%,rgba(13,17,14,.72)_46%,rgba(13,17,14,.18)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(13,17,14,.82)_0%,transparent_45%)]" />
          <div className="absolute -bottom-32 -right-16 h-[520px] w-[520px] rounded-full border border-[#d7b46a]/20" />
          <div className="absolute -bottom-20 -right-8 h-[380px] w-[380px] rounded-full border border-[#d7b46a]/15" />

          <div className="relative mx-auto flex min-h-[820px] max-w-[1500px] items-end px-4 pb-12 pt-40 sm:px-6 lg:min-h-[880px] lg:items-center lg:px-10 lg:pb-24 lg:pt-40">
            <div className="max-w-3xl">
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur-md">
                  <Star className="h-3.5 w-3.5 fill-[#e2bf73] text-[#e2bf73]" /> 4,1 på Google · 223 omdömen
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur-md">
                  <Waves className="h-3.5 w-3.5 text-[#e2bf73]" /> Vid vattnet på Kungsholmen
                </span>
              </div>

              <p className="mb-4 text-xs font-black uppercase tracking-[0.28em] text-[#e2bf73] sm:text-sm">
                Italiensk matupplevelse · Hornsbergs Strand
              </p>
              <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-[.92] tracking-[-0.045em] sm:text-7xl lg:text-[92px]">
                Italien känns
                <span className="block italic text-[#e8c77f]">lite närmare här.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8">
                Vedugnsbakad pizza, färsk pasta och en varm trattoria-känsla precis vid Hornsbergs Strand. För lunch med kollegor, middag med familjen eller ett glas vin med vänner.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#boka"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e2bf73] px-6 py-3.5 text-sm font-black text-[#171b17] shadow-[0_18px_60px_rgba(226,191,115,.28)] transition hover:-translate-y-0.5 hover:bg-[#f0cf86]"
                >
                  <CalendarDays className="h-4 w-4" /> Boka bord <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="#meny"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/8 px-6 py-3.5 text-sm font-black text-white backdrop-blur-md transition hover:bg-white/14"
                >
                  <UtensilsCrossed className="h-4 w-4" /> Se menyn
                </a>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs font-semibold text-white/55 sm:text-sm">
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-[#e2bf73]" /> Hornsbergs Strand 77</span>
                <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#e2bf73]" /> Öppet alla dagar</span>
                <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-[#e2bf73]" /> 08-656 84 00</span>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-20 -mt-7 px-4 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[1380px] grid-cols-2 overflow-hidden rounded-[1.8rem] border border-black/5 bg-white shadow-[0_25px_80px_rgba(33,36,29,.12)] sm:grid-cols-4">
            {quickActions.map(({ icon: Icon, label, href }, index) => (
              <a
                key={label}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noreferrer" : undefined}
                className={`group flex items-center gap-3 px-4 py-5 transition hover:bg-[#f7f0df] sm:px-6 sm:py-6 ${index % 2 === 0 ? "border-r border-black/5" : ""} ${index < 2 ? "border-b border-black/5 sm:border-b-0" : ""} sm:border-r sm:last:border-r-0`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1d241f] text-[#e8c77f] transition group-hover:scale-105">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span>
                  <span className="block text-xs font-black sm:text-sm">{label}</span>
                  <span className="mt-0.5 hidden text-[11px] font-semibold text-[#747a73] sm:block">Snabbt & enkelt</span>
                </span>
              </a>
            ))}
          </div>
        </section>

        <section id="meny" className="mx-auto max-w-[1500px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9f7a33]">Smaker att längta tillbaka till</p>
              <h2 className="mt-3 max-w-3xl font-serif text-4xl font-semibold tracking-[-0.035em] sm:text-6xl">Favoriter från köket</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Populärt", "Pizza", "Pasta", "Kött", "Vegetariskt"].map((item, index) => (
                <span
                  key={item}
                  className={`rounded-full px-4 py-2 text-xs font-black ${index === 0 ? "bg-[#1d241f] text-white" : "border border-[#d7d2c7] bg-white/60 text-[#4d554f]"}`}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {menuItems.map((item, index) => (
              <article key={item.name} className="group overflow-hidden rounded-[2rem] bg-[#1c211d] text-white shadow-[0_20px_65px_rgba(35,37,31,.1)]">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img src={item.image} alt={`Illustrativ bild för ${item.name}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                  <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#1c211d] backdrop-blur">{index === 0 ? "Doni’s val" : "Populärt"}</span>
                </div>
                <div className="p-6 sm:p-7">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h3 className="font-serif text-2xl font-semibold">{item.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/58">{item.text}</p>
                    </div>
                    <span className="shrink-0 text-sm font-black text-[#e8c77f]">{item.price}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <a href="#boka" className="inline-flex items-center gap-2 rounded-full border border-[#c9c3b8] bg-white/55 px-5 py-3 text-sm font-black transition hover:bg-white">
              Se hela menyn <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        <section id="upplevelse" className="bg-[#182019] px-4 py-20 text-white sm:px-6 lg:px-10 lg:py-24">
          <div className="mx-auto grid max-w-[1500px] gap-6 lg:grid-cols-[1.08fr_.92fr]">
            <div className="relative min-h-[560px] overflow-hidden rounded-[2.4rem] lg:min-h-[680px]">
              <img
                src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=88"
                alt="Illustrativ italiensk restaurangmiljö"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-7 sm:p-10">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-bold backdrop-blur-md"><Waves className="h-4 w-4 text-[#e8c77f]" /> Hornsbergs Strand</span>
                <p className="mt-5 max-w-xl font-serif text-4xl font-semibold leading-tight sm:text-5xl">Middag vid vattnet. Utan att lämna stan.</p>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-[2.4rem] bg-[#f4ecdc] p-8 text-[#1c211d] sm:p-10 lg:p-12">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9a742e]">Doni’s Trattoria</p>
                <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-5xl">Italiensk passion med plats för hela kvällen.</h2>
                <p className="mt-6 text-base leading-8 text-[#5f655f]">
                  Konceptet lyfter det Doni’s redan är bra på: färsk pasta, vedugnsbakad pizza, personlig service och läget precis vid vattnet. Mindre generisk text – mer känsla, tydliga val och snabb väg till bokning.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {["Färsk pasta", "Vedugnsbakad pizza", "Uteservering", "Lunch & middag"].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/65 px-4 py-3 text-sm font-black">
                      <Check className="h-4 w-4 text-[#9a742e]" /> {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7">
                  <div className="flex items-center gap-1 text-[#e8c77f]">
                    {[0, 1, 2, 3, 4].map((item) => <Star key={item} className="h-4 w-4 fill-current" />)}
                  </div>
                  <p className="mt-5 font-serif text-2xl font-semibold">“En plats man gärna stannar kvar på.”</p>
                  <p className="mt-3 text-sm text-white/48">Demo på hur Google-omdömen kan få en tydlig plats i den nya sidan.</p>
                </div>
                <div className="rounded-[2rem] bg-[#d7b46a] p-7 text-[#1b201c]">
                  <Instagram className="h-6 w-6" />
                  <p className="mt-5 font-serif text-2xl font-semibold">Mer mat. Mer känsla. Mer Doni’s.</p>
                  <p className="mt-3 text-sm font-semibold text-black/55">Instagram och aktuella bilder kan kopplas direkt till sidan.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="erbjudande" className="mx-auto max-w-[1500px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <div className="overflow-hidden rounded-[2.5rem] bg-[#dcb767] shadow-[0_30px_100px_rgba(160,118,42,.14)]">
            <div className="grid lg:grid-cols-[.88fr_1.12fr]">
              <div className="p-8 sm:p-12 lg:p-16">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#1c211d] px-3.5 py-2 text-xs font-black uppercase tracking-[0.13em] text-white">
                  <Gift className="h-4 w-4 text-[#e8c77f]" /> Proffera-erbjudande
                </div>
                <h2 className="mt-6 max-w-xl font-serif text-5xl font-semibold leading-[.98] tracking-[-0.04em] sm:text-6xl">20% på pasta varje tisdag.</h2>
                <p className="mt-5 max-w-xl text-base font-semibold leading-7 text-black/58">
                  Ett exempel på hur Doni’s kan skapa en kampanj i Proffera och visa samma erbjudande på webbplatsen, företagssidan och i ett e-postutskick.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="rounded-full bg-white/55 px-4 py-2 text-xs font-black">Gäller tisdagar</span>
                  <span className="rounded-full bg-white/55 px-4 py-2 text-xs font-black">På plats</span>
                  <span className="rounded-full bg-white/55 px-4 py-2 text-xs font-black">Demoerbjudande</span>
                </div>
              </div>

              <div className="relative min-h-[420px] overflow-hidden bg-[#1b211c]">
                <img
                  src="https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1600&q=90"
                  alt="Illustrativ pastarätt"
                  className="absolute inset-0 h-full w-full object-cover opacity-78"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#1b211c]/75 via-[#1b211c]/10 to-transparent" />
                <div className="absolute bottom-7 right-7 max-w-xs rounded-[1.5rem] border border-white/20 bg-white/90 p-5 text-[#1c211d] shadow-2xl backdrop-blur-xl sm:bottom-10 sm:right-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8f6b2e]">Synkat via Proffera</p>
                  <p className="mt-2 text-lg font-black">Kampanj publicerad</p>
                  <div className="mt-4 space-y-2 text-xs font-bold text-[#5f655f]">
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#2e7f51]" /> Webbsida</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#2e7f51]" /> Proffera-profil</p>
                    <p className="flex items-center gap-2"><Check className="h-4 w-4 text-[#2e7f51]" /> E-postkampanj</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="boka" className="bg-[#ece5d8] px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
          <div className="mx-auto grid max-w-[1380px] gap-6 lg:grid-cols-[.84fr_1.16fr]">
            <div className="rounded-[2.3rem] bg-[#1b211c] p-8 text-white sm:p-10 lg:p-12">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#e8c77f]">Boka bord</p>
              <h2 className="mt-4 font-serif text-5xl font-semibold leading-none tracking-[-0.04em]">En bokning som känns lika enkel som ett sms.</h2>
              <p className="mt-5 text-base leading-7 text-white/58">I den färdiga lösningen kan nuvarande bokningssystem kopplas in eller ersättas med ett tydligare flöde. Här visar vi bara upplevelsen.</p>
              <div className="mt-8 space-y-3 text-sm font-bold text-white/72">
                <p className="flex items-center gap-3"><Check className="h-4 w-4 text-[#e8c77f]" /> Mobilanpassat bokningsflöde</p>
                <p className="flex items-center gap-3"><Check className="h-4 w-4 text-[#e8c77f]" /> Bekräftelse och påminnelse</p>
                <p className="flex items-center gap-3"><Check className="h-4 w-4 text-[#e8c77f]" /> Koppling till kundlista i Proffera</p>
              </div>
            </div>

            <div className="rounded-[2.3rem] border border-black/5 bg-white p-6 shadow-[0_25px_90px_rgba(42,42,35,.08)] sm:p-8 lg:p-10">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#6c726c]">Datum</span>
                  <div className="flex h-13 items-center justify-between rounded-2xl border border-[#dedbd2] bg-[#fbfaf7] px-4 text-sm font-bold">Välj datum <CalendarDays className="h-4 w-4 text-[#927039]" /></div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#6c726c]">Tid</span>
                  <div className="flex h-13 items-center justify-between rounded-2xl border border-[#dedbd2] bg-[#fbfaf7] px-4 text-sm font-bold">19:00 <Clock3 className="h-4 w-4 text-[#927039]" /></div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#6c726c]">Antal gäster</span>
                  <div className="flex h-13 items-center justify-between rounded-2xl border border-[#dedbd2] bg-[#fbfaf7] px-4 text-sm font-bold">2 gäster <ChevronRight className="h-4 w-4 text-[#927039]" /></div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#6c726c]">Kontakt</span>
                  <div className="flex h-13 items-center justify-between rounded-2xl border border-[#dedbd2] bg-[#fbfaf7] px-4 text-sm font-bold">Ditt namn & mobil <ChevronRight className="h-4 w-4 text-[#927039]" /></div>
                </label>
              </div>
              <button type="button" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1c211d] px-5 py-4 text-sm font-black text-white shadow-lg">
                Visa lediga bord <ArrowRight className="h-4 w-4 text-[#e8c77f]" />
              </button>
              <p className="mt-3 text-center text-[11px] font-semibold text-[#8a8e89]">Demoläge – knappen skickar ingen riktig bokning.</p>
            </div>
          </div>
        </section>

        <section id="kontakt" className="mx-auto max-w-[1500px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#9f7a33]">Hitta till oss</p>
              <h2 className="mt-3 font-serif text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">Hornsbergs Strand 77</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#686f69]">Precis vid vattnet på Kungsholmen, Stockholm. Kom för lunchen. Stanna för utsikten.</p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <a href="tel:+4686568400" className="flex items-center gap-3 rounded-2xl border border-[#d9d3c8] bg-white/60 p-4 text-sm font-black transition hover:bg-white"><Phone className="h-5 w-5 text-[#9b7430]" /> 08-656 84 00</a>
                <a href="mailto:donistrattoria@gmail.com" className="flex items-center gap-3 rounded-2xl border border-[#d9d3c8] bg-white/60 p-4 text-sm font-black transition hover:bg-white"><Mail className="h-5 w-5 text-[#9b7430]" /> donistrattoria@gmail.com</a>
              </div>

              <div className="mt-8 rounded-[2rem] bg-[#1d241f] p-6 text-white sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-[#e8c77f]">Öppettider</p>
                    <p className="mt-1 text-sm font-semibold text-white/50">Exempel baserat på aktuell online-information</p>
                  </div>
                  <Clock3 className="h-6 w-6 text-[#e8c77f]" />
                </div>
                <div className="mt-6 divide-y divide-white/8">
                  {hours.map(([day, time]) => (
                    <div key={day} className="flex items-center justify-between py-3 text-sm">
                      <span className="font-bold text-white/65">{day}</span>
                      <span className="font-black">{time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative min-h-[620px] overflow-hidden rounded-[2.5rem] bg-[#c8c0b0]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#ece6d9_0,transparent_22%),radial-gradient(circle_at_70%_35%,#ded3bf_0,transparent_25%),linear-gradient(135deg,#c8c0b0,#e8dfcf)]" />
              <div className="absolute left-[16%] top-[18%] h-[2px] w-[70%] rotate-[18deg] bg-white/65" />
              <div className="absolute left-[20%] top-[44%] h-[2px] w-[62%] -rotate-[22deg] bg-white/55" />
              <div className="absolute left-[8%] top-[68%] h-[2px] w-[82%] rotate-[7deg] bg-white/55" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative grid h-20 w-20 place-items-center rounded-full bg-[#1d241f] text-[#e8c77f] shadow-2xl">
                  <MapPin className="h-8 w-8" />
                  <span className="absolute -bottom-10 whitespace-nowrap rounded-full bg-white px-4 py-2 text-xs font-black text-[#1d241f] shadow-lg">Doni’s Trattoria</span>
                </div>
              </div>
              <div className="absolute bottom-6 left-6 right-6 rounded-[1.5rem] bg-white/88 p-5 shadow-xl backdrop-blur-xl sm:left-auto sm:w-80">
                <p className="text-xs font-black uppercase tracking-[0.13em] text-[#8f6d34]">Kungsholmen</p>
                <p className="mt-1 text-lg font-black">Hornsbergs Strand 77</p>
                <a href="https://www.google.com/maps/search/?api=1&query=Hornsbergs+Strand+77+Stockholm" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#315c45]">Öppna i Google Maps <ExternalLink className="h-4 w-4" /></a>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#111612] px-4 py-16 text-white sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d7b46a]/25 bg-[#d7b46a]/8 px-3 py-1.5 text-xs font-black text-[#e8c77f]"><Sparkles className="h-4 w-4" /> Powered by Proffera</div>
              <h2 className="mt-5 max-w-3xl font-serif text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-5xl">Webbplats, erbjudanden, kundkontakt och uppföljning – i ett sammanhängande flöde.</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/52">Det här konceptet visar hur Doni’s kan få en starkare webb samtidigt som erbjudanden, kunddata, kampanjer och analys kopplas till Proffera.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [Gift, "Erbjudanden"],
                [Mail, "E-postkampanjer"],
                [MessageCircleMore, "Kundförfrågningar"],
                [Star, "Omdömen & analys"],
              ].map(([Icon, label]) => {
                const ItemIcon = Icon as typeof Gift;
                return (
                  <div key={label as string} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 p-4 text-sm font-black">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d7b46a]/10 text-[#e8c77f]"><ItemIcon className="h-4 w-4" /></span>
                    {label as string}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/8 bg-[#0e120f] px-4 py-8 text-white sm:px-6 lg:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-serif text-xl font-semibold">Doni’s Trattoria</p>
            <p className="mt-1 text-xs font-semibold text-white/38">Redesign concept demo by Proffera · Bilder i demon är illustrativa.</p>
          </div>
          <a href="https://www.proffera.se" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-[#e8c77f]">proffera.se <ArrowRight className="h-4 w-4" /></a>
        </div>
      </footer>
    </div>
  );
}
