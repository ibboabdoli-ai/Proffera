import type { Metadata } from "next";
import {
  ArrowRight,
  Clock3,
  ExternalLink,
  Mail,
  MapPin,
  Menu,
  Phone,
  Star,
  Utensils,
  Waves,
} from "lucide-react";

const assetBase = "https://www-static.restaurangkungsholmen.se/wp-content/uploads";
const heroImage = `${assetBase}/2025/05/donis-pizzorny.jpg`;
const pastaImage = `${assetBase}/2025/05/donis-pastaratter.jpg`;
const mapsUrl = "https://www.google.com/maps/search/?api=1&query=Doni%27s+Trattoria+Hornsbergs+Strand+77+Stockholm";
const mapEmbedUrl = "https://www.google.com/maps?q=Hornsbergs%20Strand%2077%20Stockholm&output=embed";

export const metadata: Metadata = {
  title: { absolute: "Doni’s Trattoria – classic restaurant concept by Proffera" },
  description:
    "Ett klassiskt och varmt restaurangkoncept för Doni’s Trattoria vid Hornsbergs Strand, inspirerat av den tydliga restaurangstrukturen på DalaNisse.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Doni’s Trattoria – redesign concept by Proffera",
    description: "Klassisk restaurangkänsla, tydlig meny och fokus på mat, miljö och kontakt.",
    type: "website",
    url: "https://www.proffera.se/demo/donis-trattoria",
    images: [{ url: heroImage, width: 1200, height: 900, alt: "Doni’s Trattoria – redesign concept" }],
  },
};

const dishes = [
  { name: "Fettuccini Donis", type: "Pasta", image: `${assetBase}/2025/06/donis-fettuccini-donis.jpg` },
  { name: "Penne alla vodka", type: "Pasta", image: `${assetBase}/2025/06/donis-penne-alla-vodka.jpg` },
  { name: "Mare mare", type: "Pizza", image: `${assetBase}/2025/06/donis-mare-mare.jpg` },
  { name: "Diavola", type: "Pizza", image: `${assetBase}/2025/06/donis-diavola.jpg` },
  { name: "Vegetariana", type: "Pizza", image: `${assetBase}/2025/06/donis-vegetariana.jpg` },
  { name: "Manzo e tartufo", type: "Secondi", image: `${assetBase}/2025/06/donis-manzo-e-tartufo.jpg` },
];

const hours = [
  ["Måndag–torsdag", "11:00–21:00"],
  ["Fredag", "11:00–22:00"],
  ["Lördag", "12:00–22:00"],
  ["Söndag", "12:00–21:00"],
];

const navItems = [
  ["Om oss", "#om"],
  ["Meny", "#meny"],
  ["Galleri", "#galleri"],
  ["Kontakt", "#kontakt"],
];

export default function DonisTrattoriaDemoPage() {
  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#1d211d] selection:bg-[#9e2f25] selection:text-white">
      <div className="border-b border-black/10 bg-[#f5f1e8] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.22em] text-black/45 sm:px-6">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
          <span>Proffera · concept preview</span>
          <span className="hidden sm:inline">Doni’s egna bilder · menyutkast</span>
        </div>
      </div>

      <main>
        <section className="relative min-h-[760px] overflow-hidden bg-[#1a1e1b] text-white">
          <img
            src={heroImage}
            alt="Pizza från Doni’s Trattoria"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/48" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/45" />

          <div className="relative mx-auto flex min-h-[760px] max-w-[1440px] flex-col px-4 pb-10 pt-5 sm:px-6 lg:px-8">
            <header className="flex items-center justify-between border-b border-white/35 pb-4">
              <a href="#top" className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-white/60 font-serif text-2xl italic">D</span>
                <div>
                  <p className="font-serif text-2xl font-semibold leading-none sm:text-3xl">Doni’s Trattoria</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-white/65">Hornsbergs Strand · Stockholm</p>
                </div>
              </a>

              <nav className="hidden items-center gap-7 text-[12px] font-bold uppercase tracking-[0.14em] lg:flex">
                {navItems.map(([label, href]) => (
                  <a key={href} href={href} className="border-b border-transparent pb-1 transition hover:border-white">{label}</a>
                ))}
              </nav>

              <details className="group relative lg:hidden">
                <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center border border-white/45 bg-black/10 [&::-webkit-details-marker]:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Öppna meny</span>
                </summary>
                <div className="absolute right-0 top-13 z-50 w-56 border border-white/20 bg-[#f5f1e8] p-2 text-[#1d211d] shadow-2xl">
                  {navItems.map(([label, href]) => (
                    <a key={href} href={href} className="block border-b border-black/8 px-3 py-3 text-sm font-bold last:border-0">{label}</a>
                  ))}
                </div>
              </details>
            </header>

            <div id="top" className="flex flex-1 items-end pb-8 sm:pb-12 lg:items-center lg:pb-0">
              <div className="max-w-4xl">
                <div className="mb-5 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85">
                  <span className="inline-flex items-center gap-2 border border-white/35 bg-black/10 px-3 py-2"><Waves className="h-3.5 w-3.5" /> Vid vattnet</span>
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-white/35 bg-black/10 px-3 py-2"><Star className="h-3.5 w-3.5" /> 4,1 på Google</a>
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#f1dfb4]">Italiensk restaurang på Kungsholmen</p>
                <h1 className="mt-5 max-w-4xl font-serif text-[58px] font-medium leading-[0.92] tracking-[-0.035em] sm:text-8xl lg:text-[108px]">
                  Doni’s<br />Trattoria
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-white/82 sm:text-lg sm:leading-8">
                  Klassisk italiensk mat, varm stämning och Hornsbergs Strand precis utanför dörren.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a href="#meny" className="inline-flex items-center gap-2 bg-[#f5f1e8] px-6 py-3.5 text-sm font-bold text-[#1d211d] transition hover:bg-white">Se menyn <ArrowRight className="h-4 w-4" /></a>
                  <a href="tel:+4686568400" className="inline-flex items-center gap-2 border border-white/55 px-6 py-3.5 text-sm font-bold transition hover:bg-white hover:text-[#1d211d]">Ring restaurangen <Phone className="h-4 w-4" /></a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="om" className="border-b border-black/10 bg-[#f5f1e8] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[.75fr_1.25fr] lg:items-start">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#8b2e25]">Om oss / About us</p>
              <h2 className="mt-4 font-serif text-5xl leading-none sm:text-6xl">Välkommen till Doni’s.</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2">
              <p className="text-base leading-8 text-black/68">
                Doni’s beskriver sitt kök som enkelt, varmt och italienskt. Fokus ligger på bra råvaror, pasta, pizza och en avslappnad restaurangupplevelse vid Hornsbergs Strand.
              </p>
              <p className="text-base leading-8 text-black/68">
                Doni’s is a relaxed Italian trattoria by the water, focused on good ingredients, generous flavours and a welcoming atmosphere for lunch, dinner and evenings with friends.
              </p>
            </div>
          </div>
        </section>

        <section id="meny" className="bg-[#fffdf8] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1280px]">
            <div className="flex flex-col gap-6 border-b border-black/15 pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#8b2e25]">Meny / Menu</p>
                <h2 className="mt-4 font-serif text-5xl sm:text-7xl">Utvalda rätter</h2>
              </div>
              <div className="max-w-xl text-sm leading-7 text-black/55">
                <p>Detta är ett menyutkast för demon. Den slutliga svenska och engelska menyn skrivs in när restaurangen skickar sin nya meny och aktuella priser.</p>
              </div>
            </div>

            <div className="mt-10 grid gap-x-12 gap-y-0 lg:grid-cols-2">
              {dishes.map((dish) => (
                <article key={dish.name} className="grid grid-cols-[90px_1fr] gap-4 border-b border-black/12 py-5 sm:grid-cols-[120px_1fr] sm:gap-6">
                  <img src={dish.image} alt={`${dish.name} från Doni’s Trattoria`} loading="lazy" decoding="async" className="aspect-square h-full w-full object-cover" />
                  <div className="flex min-w-0 flex-col justify-center">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#8b2e25]">{dish.type}</p>
                        <h3 className="mt-1 font-serif text-2xl sm:text-3xl">{dish.name}</h3>
                      </div>
                      <Utensils className="mt-1 h-4 w-4 shrink-0 text-black/30" />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-black/45">Ingredienser & pris uppdateras · Ingredients & price to be updated</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-10 flex flex-col items-start justify-between gap-5 border border-black/15 bg-[#f5f1e8] p-6 sm:flex-row sm:items-center sm:p-8">
              <div><p className="font-serif text-2xl">Svenska + English</p><p className="mt-1 text-sm text-black/50">Den slutliga menyn byggs tvåspråkig direkt på webbplatsen.</p></div>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#8b2e25]">Menu setup included <ArrowRight className="h-4 w-4" /></span>
            </div>
          </div>
        </section>

        <section id="galleri" className="bg-[#1b201c] px-4 py-20 text-white sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1280px]">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d7b77a]">Galleri / Gallery</p><h2 className="mt-4 font-serif text-5xl sm:text-7xl">Smaker från Doni’s</h2></div>
              <p className="max-w-md text-sm leading-6 text-white/52">När kunden skickar nya bilder och filmer byts detta galleri ut mot restaurangens senaste material.</p>
            </div>

            <div className="grid auto-rows-[230px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <figure className="relative overflow-hidden sm:row-span-2 lg:col-span-2"><img src={pastaImage} alt="Pastarätter från Doni’s" loading="lazy" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-black/10" /></figure>
              <figure className="overflow-hidden"><img src={`${assetBase}/2025/06/donis-diavola.jpg`} alt="Diavola från Doni’s" loading="lazy" className="h-full w-full object-cover" /></figure>
              <figure className="overflow-hidden"><img src={`${assetBase}/2025/06/donis-mare-mare.jpg`} alt="Mare mare från Doni’s" loading="lazy" className="h-full w-full object-cover" /></figure>
              <figure className="overflow-hidden"><img src={`${assetBase}/2025/06/donis-fettuccini-donis.jpg`} alt="Fettuccini Donis" loading="lazy" className="h-full w-full object-cover" /></figure>
              <figure className="overflow-hidden"><img src={`${assetBase}/2025/06/donis-vegetariana.jpg`} alt="Vegetariana från Doni’s" loading="lazy" className="h-full w-full object-cover" /></figure>
            </div>
          </div>
        </section>

        <section id="kontakt" className="bg-[#f5f1e8] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#8b2e25]">Kontakt / Contact</p>
              <h2 className="mt-4 font-serif text-5xl leading-none sm:text-7xl">Hornsbergs Strand 77</h2>
              <p className="mt-5 max-w-lg text-base leading-8 text-black/60">112 16 Stockholm · Kungsholmen</p>

              <div className="mt-8 divide-y divide-black/12 border-y border-black/12">
                <a href="tel:+4686568400" className="flex items-center justify-between gap-5 py-4 text-sm font-bold"><span className="inline-flex items-center gap-3"><Phone className="h-4 w-4" />08-656 84 00</span><ArrowRight className="h-4 w-4" /></a>
                <a href="mailto:donistrattoria@gmail.com" className="flex items-center justify-between gap-5 py-4 text-sm font-bold"><span className="inline-flex min-w-0 items-center gap-3"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">donistrattoria@gmail.com</span></span><ArrowRight className="h-4 w-4 shrink-0" /></a>
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-5 py-4 text-sm font-bold"><span className="inline-flex items-center gap-3"><MapPin className="h-4 w-4" />Öppna i Google Maps</span><ExternalLink className="h-4 w-4" /></a>
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#8b2e25]" /><p className="text-xs font-bold uppercase tracking-[0.16em]">Öppettider i demon</p></div>
                <div className="mt-3 divide-y divide-black/10 border-t border-black/10">
                  {hours.map(([day, time]) => <div key={day} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="text-black/55">{day}</span><span className="font-bold">{time}</span></div>)}
                </div>
              </div>
            </div>

            <div className="relative min-h-[560px] overflow-hidden border border-black/10 bg-[#ddd5c8]">
              <iframe title="Doni’s Trattoria på Google Maps" src={mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="absolute inset-0 h-full w-full border-0" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/12 bg-[#171b18] px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-serif text-3xl">Doni’s Trattoria</p>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-white/40">Designkoncept av Proffera. Inspirerat av DalaNisse-modellen med tydlig restauranginformation, meny, galleri och kontakt — utan onlinebokning eller onlinebeställning i denna version.</p>
          </div>
          <a href="https://www.proffera.se" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#e0c58d]">proffera.se <ArrowRight className="h-4 w-4" /></a>
        </div>
      </footer>
    </div>
  );
}
