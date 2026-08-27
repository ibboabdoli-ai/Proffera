import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
  Waves,
} from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "Doni’s Trattoria – premium redesign concept by Proffera" },
  description:
    "Premium redesign-demo för Doni’s Trattoria vid Hornsbergs Strand, framtagen av Proffera.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Doni’s Trattoria – redesign concept by Proffera",
    description: "En modern restaurangupplevelse för Doni’s Trattoria vid Hornsbergs Strand.",
    type: "website",
  },
};

const dishes = [
  {
    name: "Fettuccine Doni’s",
    description: "Färsk fettuccine, kalvfilé, mascarpone, spenat och tryffelkräm.",
    price: "219 kr",
    category: "pasta popular",
    eyebrow: "Doni’s signatur",
    image:
      "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1400&q=88",
  },
  {
    name: "Mare Mare",
    description: "Fior di latte, scampi, gröna musslor, chili, citron och vitlök.",
    price: "190 kr",
    category: "pizza popular",
    eyebrow: "Från ugnen",
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1400&q=88",
  },
  {
    name: "Penne alla vodka",
    description: "Krämig tomatsås, mascarpone, nduja och parmesan.",
    price: "189 kr",
    category: "pasta popular",
    eyebrow: "Gästfavorit",
    image:
      "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1400&q=88",
  },
  {
    name: "Diavola",
    description: "Italiensk pizza med hetta, sälta och klassisk trattoria-känsla.",
    price: "Se meny",
    category: "pizza",
    eyebrow: "Pizza",
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1400&q=88",
  },
  {
    name: "Vegetariana",
    description: "En färgstark vegetarisk favorit med italienska smaker.",
    price: "Se meny",
    category: "pizza vegetarian",
    eyebrow: "Vegetarisk",
    image:
      "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=1400&q=88",
  },
  {
    name: "Manzo e tartufo",
    description: "Mustiga smaker med kött, tryffel och italiensk karaktär.",
    price: "Se meny",
    category: "popular",
    eyebrow: "Från köket",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=88",
  },
];

const hours = [
  ["Måndag–torsdag", "11:00–21:00"],
  ["Fredag", "11:00–22:00"],
  ["Lördag", "12:00–22:00"],
  ["Söndag", "12:00–21:00"],
];

const quickActions = [
  {
    icon: CalendarDays,
    label: "Boka bord",
    sub: "Se lediga tider",
    href: "#boka",
    booking: true,
  },
  {
    icon: UtensilsCrossed,
    label: "Beställ online",
    sub: "Takeaway & leverans",
    href: "https://wolt.com/en/swe/stockholm/restaurant/doni-trattoria-italiano",
  },
  {
    icon: Phone,
    label: "Ring oss",
    sub: "08-656 84 00",
    href: "tel:+4686568400",
  },
  {
    icon: MapPin,
    label: "Hitta hit",
    sub: "Hornsbergs Strand 77",
    href: "https://www.google.com/maps/search/?api=1&query=Hornsbergs+Strand+77+Stockholm",
  },
];

export default function DonisTrattoriaDemoPage() {
  return (
    <div className="min-h-screen bg-[#f4f0e7] text-[#171b18] selection:bg-[#d8b56b] selection:text-[#171b18]">
      <div className="sticky top-0 z-50 border-b border-white/10 bg-[#0f1411]/95 px-4 py-2 text-white backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/60 sm:text-[11px]">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#d8b56b] text-[#101411]">P</span>
            Proffera · concept preview
          </div>
          <div className="hidden text-[11px] font-semibold text-white/40 sm:block">
            Illustrativ demo · inga riktiga bokningar eller utskick skickas
          </div>
        </div>
      </div>

      <main>
        <section className="relative min-h-[900px] overflow-hidden bg-[#101410] text-white">
          <img
            src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=2400&q=92"
            alt="Illustrativ italiensk restaurangmiljö"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,11,8,.96)_0%,rgba(7,11,8,.76)_46%,rgba(7,11,8,.18)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />

          <div className="relative mx-auto flex min-h-[900px] max-w-[1500px] flex-col px-4 pb-14 pt-6 sm:px-6 lg:px-10">
            <header className="flex items-center justify-between rounded-full border border-white/15 bg-black/20 px-4 py-3 shadow-2xl backdrop-blur-xl sm:px-5">
              <a href="#top" className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d9bd7d]/60 bg-black/25 font-serif text-xl italic text-[#f0d18a]">
                  D
                </span>
                <div className="min-w-0">
                  <p className="truncate font-serif text-lg font-semibold leading-none sm:text-xl">Doni’s Trattoria</p>
                  <p className="mt-1 hidden text-[9px] font-black uppercase tracking-[0.2em] text-white/42 sm:block">
                    Hornsbergs Strand · Stockholm
                  </p>
                </div>
              </a>

              <nav className="hidden items-center gap-7 text-sm font-bold text-white/68 lg:flex">
                <a href="#upplevelsen" className="transition hover:text-[#efd28f]">Om Doni’s</a>
                <a href="#meny" className="transition hover:text-[#efd28f]">Meny</a>
                <a href="#erbjudande" className="transition hover:text-[#efd28f]">Erbjudande</a>
                <a href="#kontakt" className="transition hover:text-[#efd28f]">Kontakt</a>
              </nav>

              <a
                href="#boka"
                data-booking-trigger
                className="inline-flex items-center gap-2 rounded-full bg-[#dfbf76] px-4 py-2.5 text-xs font-black text-[#171b18] shadow-xl transition hover:-translate-y-0.5 sm:px-5 sm:text-sm"
              >
                Boka bord <ArrowRight className="h-4 w-4" />
              </a>
            </header>

            <div id="top" className="flex flex-1 items-end lg:items-center">
              <div className="max-w-[880px] pb-8 lg:pb-0">
                <div className="mb-7 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
                    <Star className="h-3.5 w-3.5 fill-[#e6c77e] text-[#e6c77e]" /> 4,1 på Google
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
                    <Waves className="h-3.5 w-3.5 text-[#e6c77e]" /> Vid vattnet på Kungsholmen
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur">
                    <BadgeCheck className="h-3.5 w-3.5 text-[#e6c77e]" /> 20+ års branscherfarenhet
                  </span>
                </div>

                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#e7c97f] sm:text-sm">
                  Italiensk passion · Hornsbergs Strand
                </p>
                <h1 className="mt-5 max-w-4xl font-serif text-[54px] font-semibold leading-[.9] tracking-[-0.05em] sm:text-7xl lg:text-[104px]">
                  Stockholm utanför.
                  <span className="block italic text-[#f0d28c]">Italien vid bordet.</span>
                </h1>
                <p className="mt-7 max-w-2xl text-base leading-7 text-white/66 sm:text-lg sm:leading-8">
                  Färsk pasta, surdegspizza och en varm trattoria-känsla precis vid Hornsbergs Strand. En plats för spontan lunch, lång middag och kvällar som får ta tid.
                </p>

                <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="#boka"
                    data-booking-trigger
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-[#dfbf76] px-7 py-4 text-sm font-black text-[#171b18] shadow-[0_20px_65px_rgba(223,191,118,.23)] transition hover:-translate-y-0.5"
                  >
                    Boka ett bord <CalendarDays className="h-4 w-4" />
                  </a>
                  <a
                    href="#meny"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/8 px-7 py-4 text-sm font-black backdrop-blur transition hover:bg-white/12"
                  >
                    Upptäck menyn <ChevronRight className="h-4 w-4" />
                  </a>
                </div>

                <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-xs font-semibold text-white/48 sm:text-sm">
                  <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" />Hornsbergs Strand 77</span>
                  <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />08-656 84 00</span>
                  <span className="inline-flex items-center gap-2"><UtensilsCrossed className="h-4 w-4" />Pizza · Pasta · Italienskt</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 -mt-8 px-4 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[1320px] grid-cols-2 overflow-hidden rounded-[1.8rem] border border-black/5 bg-[#fffdf8] shadow-[0_30px_90px_rgba(37,35,29,.14)] lg:grid-cols-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              const external = action.href.startsWith("http");
              return (
                <a
                  key={action.label}
                  href={action.href}
                  data-booking-trigger={action.booking ? "true" : undefined}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noreferrer" : undefined}
                  className={`group flex items-center gap-3 p-5 transition hover:bg-[#f3ead8] sm:p-6 ${index < 3 ? "lg:border-r lg:border-black/5" : ""} ${index < 2 ? "border-b border-black/5 lg:border-b-0" : ""}`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#18201a] text-[#e8cb85] transition group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black">{action.label}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-[#777d77]">{action.sub}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <section id="upplevelsen" className="mx-auto max-w-[1500px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <div className="grid items-stretch gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <div className="relative min-h-[620px] overflow-hidden rounded-[2.6rem] bg-[#172018]">
              <img
                src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1900&q=90"
                alt="Illustrativ restaurangupplevelse"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white sm:p-10 lg:p-12">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs font-bold backdrop-blur">
                  <Waves className="h-4 w-4 text-[#ecd08b]" /> Hornsbergs Strand
                </span>
                <h2 className="mt-5 max-w-3xl font-serif text-4xl font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl">
                  En kvarterskrog med utsikt över vattnet — och hjärtat i Italien.
                </h2>
              </div>
            </div>

            <div className="grid gap-6">
              <div className="rounded-[2.6rem] bg-[#182019] p-8 text-white sm:p-10 lg:p-12">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e2c57f]">Doni’s berättelse</p>
                <h2 className="mt-4 font-serif text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-5xl">
                  Få ingredienser. Bra råvaror. Ingen onödig krångel.
                </h2>
                <p className="mt-6 text-base leading-8 text-white/55">
                  Doni’s beskriver sin mat som rak och enkel italiensk mat byggd på bra råvaror. Teamet lyfter också mer än 20 års erfarenhet i branschen. Den nya webbupplevelsen gör just den identiteten tydlig — i stället för generiska texter.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {["Färsk pasta", "Surdegspizza", "Uteservering", "Lunch & middag"].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/7 px-4 py-3 text-sm font-black"><CheckCircle2 className="h-4 w-4 text-[#e2c57f]" />{item}</div>
                  ))}
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-[2rem] bg-[#d8b66a] p-7 text-[#171b18]">
                  <Star className="h-6 w-6 fill-current" />
                  <p className="mt-5 font-serif text-3xl font-semibold">4,1 på Google</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-black/55">Social proof nära bokningsbeslutet.</p>
                </div>
                <div className="rounded-[2rem] border border-black/7 bg-white p-7 shadow-sm">
                  <Users className="h-6 w-6 text-[#815f28]" />
                  <p className="mt-5 font-serif text-3xl font-semibold">För alla tillfällen</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6a706a]">Lunch, familjemiddag eller en kväll med vänner.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="meny" className="bg-[#121713] px-4 py-24 text-white sm:px-6 lg:px-10 lg:py-32">
          <div className="mx-auto max-w-[1500px]">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#e3c77f]">Meny · utvalda favoriter</p>
                <h2 className="mt-4 font-serif text-5xl font-semibold leading-none tracking-[-0.04em] sm:text-7xl">Låt maten göra jobbet.</h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/48">Tydliga kategorier, stora bilder och korta beskrivningar — enkelt att välja på mobilen.</p>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Filtrera meny">
                {[["all","Favoriter"],["pizza","Pizza"],["pasta","Pasta"],["vegetarian","Vegetariskt"]].map(([value,label], index) => (
                  <button key={value} type="button" data-menu-filter={value} aria-pressed={index === 0} className={`rounded-full px-4 py-2.5 text-xs font-black transition ${index === 0 ? "bg-[#e0bf73] text-[#161b17]" : "border border-white/12 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {dishes.map((dish) => (
                <article key={dish.name} data-menu-category={dish.category} className="group overflow-hidden rounded-[2rem] border border-white/8 bg-white/5 transition duration-500 hover:-translate-y-1 hover:border-white/16 hover:bg-white/[0.07]">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src={dish.image} alt={`Illustrativ bild för ${dish.name}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <span className="absolute left-5 top-5 rounded-full bg-[#fbf6ea]/92 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#171b18] backdrop-blur">{dish.eyebrow}</span>
                  </div>
                  <div className="p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-5">
                      <div><h3 className="font-serif text-2xl font-semibold">{dish.name}</h3><p className="mt-2 text-sm leading-6 text-white/48">{dish.description}</p></div>
                      <span className="shrink-0 text-sm font-black text-[#efd18b]">{dish.price}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 rounded-[1.7rem] border border-white/8 bg-white/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div><p className="text-sm font-black">Hela menyn kan kopplas till Doni’s befintliga meny.</p><p className="mt-1 text-xs font-semibold text-white/40">Priser och innehåll kan uppdateras utan att bygga om sidan.</p></div>
              <a href="https://donitrattoria.se" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-black text-[#efd18b]">Nuvarande meny <ExternalLink className="h-4 w-4" /></a>
            </div>
          </div>
        </section>

        <section id="erbjudande" className="px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <div className="mx-auto max-w-[1500px] overflow-hidden rounded-[2.8rem] bg-[#d7b366] shadow-[0_35px_110px_rgba(122,85,22,.16)]">
            <div className="grid lg:grid-cols-[.9fr_1.1fr]">
              <div className="p-8 sm:p-12 lg:p-16">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#172019] px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-white"><Sparkles className="h-4 w-4 text-[#efd18b]" /> Proffera-erbjudande</span>
                <h2 className="mt-7 max-w-2xl font-serif text-5xl font-semibold leading-[.96] tracking-[-0.045em] sm:text-7xl">20% på pasta varje tisdag.</h2>
                <p className="mt-6 max-w-xl text-base font-semibold leading-8 text-black/58">Ett erbjudande skapas en gång och kan sedan visas på webbplatsen, Proffera-profilen och i ett utskick till gäster som valt att få erbjudanden.</p>
                <div className="mt-8 flex flex-wrap gap-2 text-xs font-black"><span className="rounded-full bg-white/45 px-4 py-2">Gäller tisdagar</span><span className="rounded-full bg-white/45 px-4 py-2">På plats</span><span className="rounded-full bg-white/45 px-4 py-2">Demoerbjudande</span></div>
                <button type="button" data-offer-trigger className="mt-9 inline-flex items-center gap-2 rounded-full bg-[#172019] px-6 py-3.5 text-sm font-black text-white shadow-xl transition hover:-translate-y-0.5">Få erbjudandet <Mail className="h-4 w-4 text-[#efd18b]" /></button>
              </div>
              <div className="relative min-h-[520px] overflow-hidden bg-[#182019]">
                <img src="https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1800&q=92" alt="Illustrativ pasta" className="absolute inset-0 h-full w-full object-cover opacity-85" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#182019]/85 via-[#182019]/15 to-transparent" />
                <div className="absolute bottom-7 left-7 right-7 ml-auto max-w-sm rounded-[1.7rem] bg-white/92 p-6 text-[#171b18] shadow-2xl backdrop-blur-xl sm:bottom-10 sm:right-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8d682b]">Synkat via Proffera</p><p className="mt-2 text-xl font-black">Kampanj redo</p>
                  <div className="mt-5 space-y-3 text-xs font-bold text-[#616761]">{["Webbplats","Proffera-profil","E-postkampanj"].map((item) => <p key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#377050]" /> {item}</p>)}</div>
                  <div className="mt-5 border-t border-black/7 pt-4"><p className="text-[11px] font-semibold leading-5 text-[#777c77]">Utskick visas bara som demo här. Ingen riktig e-post skickas.</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="boka" className="bg-[#e9e1d3] px-4 py-24 sm:px-6 lg:px-10 lg:py-28">
          <div className="mx-auto grid max-w-[1320px] gap-6 lg:grid-cols-[.82fr_1.18fr]">
            <div className="rounded-[2.5rem] bg-[#172019] p-8 text-white sm:p-10 lg:p-12">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#e5c982]">Boka bord</p><h2 className="mt-4 font-serif text-5xl font-semibold leading-[.98] tracking-[-0.04em] sm:text-6xl">Från “jag är hungrig” till bokat på under en minut.</h2>
              <p className="mt-6 text-base leading-8 text-white/52">En mobilvänlig bokning där gästen väljer datum, antal personer, tid och kontaktuppgifter. Den riktiga lösningen kan kopplas vidare till restaurangens bokningsflöde och Proffera.</p>
              <div className="mt-8 space-y-3 text-sm font-bold text-white/66">{["Mobilanpassat bokningsflöde","Bekräftelse och påminnelse","Koppling till kundhistorik i Proffera"].map((item) => <p key={item} className="flex items-center gap-3"><CheckCircle2 className="h-4 w-4 text-[#e6ca83]" /> {item}</p>)}</div>
            </div>
            <div className="rounded-[2.5rem] border border-black/5 bg-[#fffdf8] p-6 shadow-[0_25px_90px_rgba(42,42,35,.08)] sm:p-8 lg:p-10">
              <div className="flex items-center justify-between gap-4 border-b border-black/7 pb-6"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#8c6a30]">Bokningsdemo</p><p className="mt-1 font-serif text-3xl font-semibold">Välj en kväll vid vattnet</p></div><span className="grid h-12 w-12 place-items-center rounded-full bg-[#172019] text-[#e7ca84]"><CalendarDays className="h-5 w-5" /></span></div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">{[["Datum","Välj datum",CalendarDays],["Tid","19:00",Clock3],["Antal gäster","2 gäster",Users],["Kontakt","Namn & mobil",Mail]].map(([label,value,Icon]) => { const DemoIcon = Icon as typeof CalendarDays; return <div key={String(label)}><p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7b817b]">{String(label)}</p><div className="flex min-h-14 items-center justify-between rounded-2xl border border-[#ddd7cc] bg-white px-4 py-3.5 text-sm font-bold"><span>{String(value)}</span><DemoIcon className="h-4 w-4 text-[#9b783d]" /></div></div>; })}</div>
              <button type="button" data-booking-trigger className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#172019] px-5 py-4 text-sm font-black text-white transition hover:-translate-y-0.5">Visa lediga bord <ArrowRight className="h-4 w-4 text-[#e7ca84]" /></button><p className="mt-3 text-center text-[11px] font-semibold text-[#8a8e89]">Demoläge – ingen riktig bokning skickas.</p>
            </div>
          </div>
        </section>

        <section id="kontakt" className="mx-auto max-w-[1500px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <div className="grid gap-7 lg:grid-cols-[.9fr_1.1fr]">
            <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#927035]">Hitta till Doni’s</p><h2 className="mt-4 font-serif text-5xl font-semibold tracking-[-0.045em] sm:text-7xl">Hornsbergs Strand 77</h2><p className="mt-6 max-w-xl text-base leading-8 text-[#666d67]">Precis vid vattnet på Kungsholmen. Kom för lunchen, middagen eller bara för att sitta kvar lite längre.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2"><a href="tel:+4686568400" className="group rounded-2xl border border-[#d8d0c3] bg-white/65 p-4 transition hover:bg-white"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8c713f]">Telefon</p><p className="mt-1 flex items-center gap-2 text-sm font-black"><Phone className="h-4 w-4" />08-656 84 00</p></a><a href="mailto:donistrattoria@gmail.com" className="group rounded-2xl border border-[#d8d0c3] bg-white/65 p-4 transition hover:bg-white"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8c713f]">E-post</p><p className="mt-1 flex items-center gap-2 truncate text-sm font-black"><Mail className="h-4 w-4" />donistrattoria@gmail.com</p></a></div>
              <div className="mt-7 rounded-[2rem] bg-[#172019] p-7 text-white"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.15em] text-[#e7ca84]">Öppettider</p><Clock3 className="h-5 w-5 text-[#e7ca84]" /></div><div className="mt-5 divide-y divide-white/8">{hours.map(([day,time]) => <div key={day} className="flex items-center justify-between gap-5 py-3 text-sm"><span className="font-bold text-white/52">{day}</span><span className="font-black">{time}</span></div>)}</div></div>
              <a href="https://www.instagram.com/donistrattoriahornsbergsstrand/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#4f5e54]">Följ Doni’s på Instagram <ExternalLink className="h-3.5 w-3.5" /></a>
            </div>
            <a href="https://www.google.com/maps/search/?api=1&query=Hornsbergs+Strand+77+Stockholm" target="_blank" rel="noreferrer" className="group relative min-h-[640px] overflow-hidden rounded-[2.6rem] bg-[#d9d0bf]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_28%,rgba(255,255,255,.9),transparent_25%),linear-gradient(135deg,#c9c0ad,#eee4d2)]" /><div className="absolute left-[10%] top-[18%] h-[2px] w-[78%] rotate-[16deg] bg-white/70" /><div className="absolute left-[16%] top-[42%] h-[2px] w-[68%] -rotate-[20deg] bg-white/65" /><div className="absolute left-[9%] top-[69%] h-[2px] w-[82%] rotate-[7deg] bg-white/60" /><div className="absolute left-[26%] top-[7%] h-[88%] w-[2px] rotate-[8deg] bg-white/50" /><div className="absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#172019] text-[#e7ca84] shadow-2xl transition group-hover:scale-105"><MapPin className="h-9 w-9" /></div><div className="absolute bottom-7 left-7 right-7 rounded-[1.7rem] bg-white/92 p-6 shadow-xl backdrop-blur-xl sm:left-auto sm:w-[360px]"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8d682c]">Kungsholmen · Stockholm</p><p className="mt-2 text-xl font-black">Hornsbergs Strand 77</p><p className="mt-2 text-sm font-semibold text-[#747a74]">112 16 Stockholm</p><p className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#315c45]">Öppna i Google Maps <ArrowRight className="h-4 w-4" /></p></div></a>
          </div>
        </section>

        <section className="bg-[#0f1411] px-4 py-20 text-white sm:px-6 lg:px-10"><div className="mx-auto grid max-w-[1500px] gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center"><div><div className="inline-flex items-center gap-2 rounded-full border border-[#d7b46a]/25 bg-[#d7b46a]/8 px-3 py-1.5 text-xs font-black text-[#e7ca89]"><Sparkles className="h-4 w-4" /> Powered by Proffera</div><h2 className="mt-5 max-w-3xl font-serif text-4xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl">Snyggare webb är början. Mer återkommande gäster är målet.</h2><p className="mt-5 max-w-2xl text-base leading-8 text-white/46">Proffera kopplar ihop webbplatsen med erbjudanden, kundkontakt, bokningsflöden och enkel uppföljning — så restaurangen får mer än bara en ny design.</p></div><div className="grid gap-3 sm:grid-cols-2">{[[Sparkles,"Erbjudanden","Skapa och publicera kampanjer"],[Mail,"E-postkampanjer","Nå gäster som valt att få utskick"],[Users,"Kundkontakt","Samla bokningar och förfrågningar"],[BarChart3,"Analys","Följ klick, bokningar och respons"]].map(([Icon,title,text]) => { const CardIcon = Icon as typeof Sparkles; return <div key={String(title)} className="rounded-2xl border border-white/8 bg-white/5 p-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d7b46a]/10 text-[#e7ca89]"><CardIcon className="h-5 w-5" /></span><p className="mt-4 text-sm font-black">{String(title)}</p><p className="mt-1 text-xs font-semibold leading-5 text-white/38">{String(text)}</p></div>; })}</div></div></section>
      </main>

      <footer className="border-t border-white/8 bg-[#0b0e0c] px-4 py-9 text-white sm:px-6 lg:px-10"><div className="mx-auto flex max-w-[1500px] flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-serif text-2xl font-semibold">Doni’s Trattoria</p><p className="mt-2 max-w-xl text-xs font-semibold leading-5 text-white/32">Premium redesign concept by Proffera. Bilder i demon är illustrativa. Uppgifter om adress, kontakt, menyinriktning och öppettider bygger på restaurangens publika information.</p></div><a href="https://www.proffera.se" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#e7ca89]">proffera.se <ArrowRight className="h-4 w-4" /></a></div></footer>
    </div>
  );
}
