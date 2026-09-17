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
  Waves,
} from "lucide-react";

const assetBase = "https://www-static.restaurangkungsholmen.se/wp-content/uploads";
const heroImage = `${assetBase}/2025/05/donis-pizzorny.jpg`;
const pastaImage = `${assetBase}/2025/05/donis-pastaratter.jpg`;
const mapsUrl = "https://www.google.com/maps/search/?api=1&query=Doni%27s+Trattoria+Hornsbergs+Strand+77+Stockholm";

export const metadata: Metadata = {
  title: { absolute: "Doni’s Trattoria – DalaNisse-inspired concept by Proffera" },
  description:
    "Ett varmt, klassiskt restaurangkoncept för Doni’s Trattoria vid Hornsbergs Strand, inspirerat av DalaNisses tydliga mobila restauranglayout.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Doni’s Trattoria – redesign concept by Proffera",
    description: "Mat, meny, galleri och kontakt i en tydlig klassisk restauranglayout.",
    type: "website",
    url: "https://www.proffera.se/demo/donis-trattoria",
    images: [{ url: heroImage, width: 1200, height: 900, alt: "Doni’s Trattoria – redesign concept" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Doni’s Trattoria – redesign concept by Proffera",
    description: "Mat, meny, galleri och kontakt i en tydlig klassisk restauranglayout.",
    images: [heroImage],
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
  ["Hem", "#top"],
  ["Om oss", "#om"],
  ["Meny", "#meny"],
  ["Galleri", "#galleri"],
  ["Kontakt", "#kontakt"],
];

const imageLinks = [
  {
    label: "Meny / Menu",
    href: "#meny",
    image: pastaImage,
  },
  {
    label: "Galleri / Gallery",
    href: "#galleri",
    image: `${assetBase}/2025/06/donis-fettuccini-donis.jpg`,
  },
  {
    label: "Kontakt / Contact",
    href: "#kontakt",
    image: `${assetBase}/2025/06/donis-diavola.jpg`,
  },
];

export default function DonisTrattoriaDemoPage() {
  return (
    <div className="min-h-screen bg-white text-[#171717] selection:bg-black selection:text-white">
      <div className="bg-black px-4 py-2 text-center text-[9px] font-bold uppercase tracking-[0.22em] text-white/40">
        Concept preview by Proffera
      </div>

      <main>
        <section id="top" className="bg-black text-white">
          <div className="mx-auto max-w-[1400px] px-4 pb-7 pt-5 sm:px-6 lg:px-8">
            <header className="grid grid-cols-[52px_1fr_52px] items-center gap-3">
              <details className="group relative z-50">
                <summary className="grid h-12 w-12 cursor-pointer list-none place-items-center text-white [&::-webkit-details-marker]:hidden">
                  <Menu className="h-9 w-9" strokeWidth={2.6} />
                  <span className="sr-only">Öppna meny</span>
                </summary>
                <div className="absolute left-0 top-14 w-64 border border-white/10 bg-[#202020] p-2 shadow-2xl">
                  {navItems.map(([label, href]) => (
                    <a
                      key={href}
                      href={href}
                      className="block border-b border-white/10 px-4 py-3 text-sm font-semibold text-white last:border-0"
                    >
                      {label}
                    </a>
                  ))}
                </div>
              </details>

              <a href="#top" className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/70 sm:text-xs">Restaurang</p>
                <p className="mt-1 font-serif text-[31px] font-semibold uppercase leading-none tracking-[-0.035em] sm:text-[42px]">
                  Doni’s Trattoria
                </p>
              </a>

              <div aria-hidden="true" />
            </header>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/9] lg:max-h-[760px]">
            <img
              src={heroImage}
              alt="Mat från Doni’s Trattoria"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        </section>

        <section id="om" className="bg-white px-5 py-16 text-center sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[880px]">
            <h1 className="text-[42px] font-light uppercase leading-[1.04] tracking-[0.01em] text-[#6d6969] sm:text-6xl">
              Restaurang<br />Doni’s Trattoria
            </h1>
            <div className="mx-auto mt-10 max-w-[760px] font-serif text-[20px] leading-[1.55] text-[#191919] sm:text-2xl sm:leading-[1.6]">
              <p>Varmt välkommen till Doni’s Trattoria vid Hornsbergs Strand.</p>
              <p className="mt-4">
                Vi serverar klassisk italiensk mat med fokus på bra råvaror, pasta, pizza och en varm, avslappnad restaurangkänsla precis vid vattnet.
              </p>
              <p className="mt-5 text-[16px] leading-7 text-black/62 sm:text-lg">
                Welcome to Doni’s Trattoria — an Italian restaurant by the water on Kungsholmen, focused on good ingredients, generous flavours and a relaxed atmosphere.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white">
          {imageLinks.map((item) => (
            <a key={item.href} href={item.href} className="group relative block border-t-[14px] border-white first:border-t-0">
              <div className="relative aspect-[16/9] overflow-hidden sm:aspect-[2.1/1]">
                <img
                  src={item.image}
                  alt={item.label}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                />
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 grid place-items-center px-6 text-center">
                  <span className="text-4xl font-medium text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.8)] sm:text-6xl">
                    {item.label}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </section>

        <section id="meny" className="bg-[#f6f3ee] px-5 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[1100px]">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-black/45">Meny / Menu</p>
              <h2 className="mt-3 font-serif text-5xl font-medium sm:text-6xl">Doni’s meny</h2>
              <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-black/50 sm:text-base">
                Demo-utkast. Den slutliga menyn skrivs in på svenska och engelska när restaurangen skickar sin nya meny och aktuella priser.
              </p>
            </div>

            <div className="mt-10 grid gap-x-10 lg:grid-cols-2">
              {dishes.map((dish) => (
                <article key={dish.name} className="grid grid-cols-[88px_1fr] gap-4 border-b border-black/15 py-5 sm:grid-cols-[108px_1fr] sm:gap-6">
                  <img
                    src={dish.image}
                    alt={`${dish.name} från Doni’s Trattoria`}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square h-full w-full object-cover"
                  />
                  <div className="flex min-w-0 flex-col justify-center">
                    <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-black/45">{dish.type}</p>
                    <h3 className="mt-1 font-serif text-2xl sm:text-3xl">{dish.name}</h3>
                    <p className="mt-2 text-[11px] leading-5 text-black/48">
                      Svenska: ingredienser och pris uppdateras<br />
                      English: ingredients and price to be updated
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="galleri" className="bg-white px-0 py-0">
          <div className="grid gap-[6px] sm:grid-cols-2 lg:grid-cols-4">
            <figure className="relative min-h-[360px] sm:col-span-2 sm:min-h-[520px]">
              <img src={pastaImage} alt="Pastarätter från Doni’s" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            </figure>
            <figure className="relative min-h-[260px]"><img src={`${assetBase}/2025/06/donis-mare-mare.jpg`} alt="Mare mare" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /></figure>
            <figure className="relative min-h-[260px]"><img src={`${assetBase}/2025/06/donis-diavola.jpg`} alt="Diavola" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /></figure>
            <figure className="relative min-h-[260px]"><img src={`${assetBase}/2025/06/donis-fettuccini-donis.jpg`} alt="Fettuccini Donis" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /></figure>
            <figure className="relative min-h-[260px]"><img src={`${assetBase}/2025/06/donis-vegetariana.jpg`} alt="Vegetariana" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /></figure>
          </div>
        </section>

        <section id="kontakt" className="bg-[#202020] px-5 py-16 text-center text-white sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[760px]">
            <p className="font-serif text-4xl sm:text-5xl">Doni’s Trattoria</p>

            <div className="mt-9 space-y-7 font-serif text-xl leading-8 sm:text-2xl">
              <div>
                <p className="text-white/62">Adress:</p>
                <p>Hornsbergs Strand 77<br />112 16 Stockholm</p>
              </div>

              <div>
                <p className="text-white/62">Telefon:</p>
                <a href="tel:+4686568400" className="underline underline-offset-4">08-656 84 00</a>
              </div>

              <div>
                <p className="text-white/62">E-post:</p>
                <a href="mailto:donistrattoria@gmail.com" className="break-all underline underline-offset-4">donistrattoria@gmail.com</a>
              </div>

              <div>
                <p className="text-white/62">Hemsida:</p>
                <a href="#top" className="underline underline-offset-4">Doni’s Trattoria</a>
              </div>
            </div>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3 text-sm font-bold">
              <a href="https://www.instagram.com/donistrattoriahornsbergsstrand/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5">
                Instagram <ExternalLink className="h-4 w-4" />
              </a>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5">
                Google Maps <MapPin className="h-4 w-4" />
              </a>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2.5">
                <Star className="h-4 w-4" /> 4,1 Google
              </span>
            </div>

            <div className="mx-auto mt-14 max-w-[560px] border-t border-white/15 pt-12">
              <div className="flex items-center justify-center gap-2">
                <Clock3 className="h-5 w-5 text-white/65" />
                <h2 className="text-4xl font-medium">Öppettider</h2>
              </div>
              <div className="mt-8 divide-y divide-white/10 text-left font-serif text-lg sm:text-xl">
                {hours.map(([day, time]) => (
                  <div key={day} className="flex items-center justify-between gap-5 py-4">
                    <span className="text-white/70">{day}</span>
                    <span>{time}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-white/35">Öppettiderna kontrolleras mot restaurangens aktuella information före slutlig publicering.</p>
            </div>

            <div className="mt-14 flex flex-wrap items-center justify-center gap-5 text-xs font-bold uppercase tracking-[0.18em] text-white/45">
              <span className="inline-flex items-center gap-2"><Waves className="h-4 w-4" /> Hornsbergs Strand</span>
              <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" /> Ring oss</span>
              <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> Kontakt</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-black px-5 py-6 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        Doni’s Trattoria · design concept by Proffera
      </footer>
    </div>
  );
}
