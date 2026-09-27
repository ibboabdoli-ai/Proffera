"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Globe2,
  ImagePlus,
  Camera,
  Languages,
  MapPin,
  Menu,
  PencilLine,
  Phone,
  Save,
  ShoppingBag,
  UtensilsCrossed,
  X,
} from "lucide-react";

type Lang = "sv" | "en";

const assetBase = "https://www-static.restaurangkungsholmen.se/wp-content/uploads";
const defaultHeroImage = assetBase + "/2025/05/donis-pizzorny.jpg";
const pastaImage = assetBase + "/2025/05/donis-pastaratter.jpg";

const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=Doni%27s+Trattoria+Hornsbergs+Strand+77+Stockholm";
const orderUrl =
  "https://qopla.com/restaurant/doni-trattoria-italiana/qyZkGvbq9M/order";
const instagramUrl =
  "https://www.instagram.com/donistrattoriahornsbergsstrand/";

const copy = {
  sv: {
    preview: "Konceptdemo · Doni’s Trattoria",
    adminPreview: "Adminvy",
    nav: {
      home: "Hem",
      about: "Om oss",
      menu: "Meny",
      gallery: "Galleri",
      contact: "Kontakt",
    },
    restaurant: "Restaurang",
    heroEyebrow: "Italiensk trattoria · Hornsbergs Strand",
    heroTitle: "Italiensk värme vid vattnet",
    heroText:
      "Familjedrivet, avslappnat och gjort för sällskap med olika smaker — från italienska favoriter till ett litet urval klassiker från Europa.",
    seeMenu: "Se menyn",
    bookGoogle: "Boka via Google",
    orderOnline: "Beställ online",
    aboutEyebrow: "Om Doni’s",
    aboutTitle: "En familjedriven trattoria med plats för fler smaker",
    aboutText:
      "Doni’s Trattoria är ett familjedrivet ställe vid Hornsbergs Strand. Här ska gästen känna människorna bakom restaurangen — inte bara se ett namn på en skylt. Grunden är italiensk matglädje, bra råvaror och en varm, personlig restaurangkänsla.",
    aboutText2:
      "Samtidigt vill vi göra det enkelt för familjer och sällskap med olika önskemål att hitta något de gillar. Därför får några utvalda europeiska klassiker en egen liten plats i menyn utan att den italienska identiteten försvinner.",
    family: "Familjedrivet",
    waterfront: "Vid vattnet",
    bilingual: "Svenska + English",
    europeEyebrow: "Nytt i menyn",
    europeTitle: "En smak av Europa",
    europeText:
      "Ett litet, tydligt urval för sällskap där alla inte vill äta samma typ av mat. Fyra europeiska klassiker kompletterar den italienska kärnan.",
    discover: "Upptäck rätterna",
    menuEyebrow: "Digital meny",
    menuTitle: "Italienska favoriter",
    menuText:
      "Det här är en designförhandsvisning. Restaurangens nya meny, slutliga beskrivningar och aktuella priser läggs in när materialet är klart.",
    priceComing: "Pris uppdateras",
    europeanMenuLabel: "Specialmeny",
    europeanMenuIntro:
      "Öppna den här delen för att se de fyra planerade europeiska rätterna.",
    pairing: "Dryckesrekommendation",
    pairingPending: "läggs in tillsammans med slutmenyn",
    galleryEyebrow: "Galleri",
    galleryTitle: "Mat, miljö och känsla",
    galleryText:
      "Egna bilder från restaurangen ersätter demobilderna. Bilder kan bytas av restaurangen själv i den färdiga lösningen.",
    actionTitle: "Boka bord eller beställ med systemen ni redan använder",
    actionText:
      "Vi bygger inte om ett fungerande flöde i onödan. Bokning går vidare via Google och onlinebeställning via Qopla.",
    visit: "Besök oss",
    hours: "Öppettider",
    currentInfo: "Aktuella öppettider kontrolleras mot Google före slutlig publicering.",
    editDemo: "Redigera demon",
    adminIntro:
      "Det här visar hur en enkel innehållspanel kan kännas. Ändringarna gäller bara den här demosessionen och sparas inte i ett riktigt CMS.",
    editHero: "Huvudrubrik",
    editAbout: "Om oss-text",
    uploadHero: "Byt huvudbild",
    uploadHelp: "Välj en bild från enheten. Den används direkt i förhandsvisningen.",
    editPrices: "Priser i menyn",
    pricePlaceholder: "t.ex. 195 kr",
    adminCapabilities: "I skarp version kan restaurangen själv uppdatera:",
    capabilityList: [
      "meny och priser",
      "bilder och galleri",
      "texter på svenska och engelska",
      "öppettider och kontaktinformation",
    ],
    close: "Stäng",
    apply: "Visa ändringarna",
    demoSaved: "Ändringarna visas nu i demon",
    language: "Språk",
    menuOpen: "Öppna meny",
  },
  en: {
    preview: "Concept demo · Doni’s Trattoria",
    adminPreview: "Admin view",
    nav: {
      home: "Home",
      about: "About",
      menu: "Menu",
      gallery: "Gallery",
      contact: "Contact",
    },
    restaurant: "Restaurant",
    heroEyebrow: "Italian trattoria · Hornsbergs Strand",
    heroTitle: "Italian warmth by the water",
    heroText:
      "Family-run, relaxed and made for groups with different tastes — from Italian favourites to a small selection of European classics.",
    seeMenu: "View menu",
    bookGoogle: "Book via Google",
    orderOnline: "Order online",
    aboutEyebrow: "About Doni’s",
    aboutTitle: "A family-run trattoria with room for more tastes",
    aboutText:
      "Doni’s Trattoria is a family-run restaurant at Hornsbergs Strand. The aim is for guests to feel the people behind the restaurant, not just a brand name. The foundation is Italian food, good ingredients and a warm, personal atmosphere.",
    aboutText2:
      "At the same time, families and groups with different preferences should all find something they enjoy. A few selected European classics therefore get a small dedicated place on the menu without taking away the Italian identity.",
    family: "Family-run",
    waterfront: "Waterfront",
    bilingual: "Swedish + English",
    europeEyebrow: "New on the menu",
    europeTitle: "A taste of Europe",
    europeText:
      "A small, focused selection for groups where everyone wants something different. Four European classics complement the Italian core.",
    discover: "Discover the dishes",
    menuEyebrow: "Digital menu",
    menuTitle: "Italian favourites",
    menuText:
      "This is a design preview. The restaurant’s new menu, final descriptions and current prices will be added when the material is ready.",
    priceComing: "Price to be updated",
    europeanMenuLabel: "Special menu",
    europeanMenuIntro:
      "Open this section to see the four planned European dishes.",
    pairing: "Drink recommendation",
    pairingPending: "will be added with the final menu",
    galleryEyebrow: "Gallery",
    galleryTitle: "Food, space and atmosphere",
    galleryText:
      "The restaurant’s own photos will replace the demo images. In the finished solution, the restaurant can update images itself.",
    actionTitle: "Book a table or order with the systems you already use",
    actionText:
      "There is no need to replace a working flow. Booking continues through Google and online ordering through Qopla.",
    visit: "Visit us",
    hours: "Opening hours",
    currentInfo: "Current opening hours are checked against Google before final publication.",
    editDemo: "Edit the demo",
    adminIntro:
      "This shows what a simple content panel can feel like. Changes only apply to this demo session and are not saved to a real CMS.",
    editHero: "Hero headline",
    editAbout: "About text",
    uploadHero: "Change hero image",
    uploadHelp: "Choose an image from your device. It is used immediately in the preview.",
    editPrices: "Menu prices",
    pricePlaceholder: "e.g. 195 kr",
    adminCapabilities: "In the live version, the restaurant can update:",
    capabilityList: [
      "menu and prices",
      "images and gallery",
      "Swedish and English copy",
      "opening hours and contact details",
    ],
    close: "Close",
    apply: "Show changes",
    demoSaved: "Changes are now shown in the demo",
    language: "Language",
    menuOpen: "Open menu",
  },
} as const;

const navItems = [
  { key: "home", href: "#top" },
  { key: "about", href: "#om" },
  { key: "menu", href: "#meny" },
  { key: "gallery", href: "#galleri" },
  { key: "contact", href: "#kontakt" },
] as const;

const menuDishes = [
  {
    name: "Fettuccini Donis",
    type: { sv: "Pasta", en: "Pasta" },
    description: {
      sv: "En av Doni’s signaturrätter. Slutlig beskrivning hämtas från restaurangens nya meny.",
      en: "One of Doni’s signature dishes. Final description will be taken from the restaurant’s new menu.",
    },
    image: assetBase + "/2025/06/donis-fettuccini-donis.jpg",
  },
  {
    name: "Penne alla vodka",
    type: { sv: "Pasta", en: "Pasta" },
    description: {
      sv: "En fyllig italiensk pastaklassiker med Doni’s egen profil.",
      en: "A rich Italian pasta classic with Doni’s own character.",
    },
    image: assetBase + "/2025/06/donis-penne-alla-vodka.jpg",
  },
  {
    name: "Mare mare",
    type: { sv: "Pizza", en: "Pizza" },
    description: {
      sv: "En havsinspirerad pizza från restaurangens italienska kärnmeny.",
      en: "A seafood-inspired pizza from the restaurant’s Italian core menu.",
    },
    image: assetBase + "/2025/06/donis-mare-mare.jpg",
  },
  {
    name: "Diavola",
    type: { sv: "Pizza", en: "Pizza" },
    description: {
      sv: "En het italiensk favorit för gäster som vill ha mer karaktär.",
      en: "A spicy Italian favourite for guests looking for more character.",
    },
    image: assetBase + "/2025/06/donis-diavola.jpg",
  },
  {
    name: "Vegetariana",
    type: { sv: "Pizza", en: "Pizza" },
    description: {
      sv: "Ett vegetariskt alternativ med tydlig italiensk känsla.",
      en: "A vegetarian option with a clear Italian character.",
    },
    image: assetBase + "/2025/06/donis-vegetariana.jpg",
  },
  {
    name: "Manzo e tartufo",
    type: { sv: "Secondi", en: "Secondi" },
    description: {
      sv: "Kött och tryffel i en fylligare rätt för den som vill ha något utanför pizza och pasta.",
      en: "Beef and truffle in a richer dish for guests wanting something beyond pizza and pasta.",
    },
    image: assetBase + "/2025/06/donis-manzo-e-tartufo.jpg",
  },
] as const;

const europeanDishes = [
  {
    name: "Wienerschnitzel",
    country: { sv: "Österrike", en: "Austria" },
    description: {
      sv: "Klassisk schnitzel som ger ett tydligt alternativ till den italienska delen av menyn.",
      en: "A classic schnitzel offering a clear alternative to the Italian side of the menu.",
    },
  },
  {
    name: "Köttbullar",
    country: { sv: "Sverige", en: "Sweden" },
    description: {
      sv: "En välkänd svensk klassiker för gäster som vill ha något tryggt och bekant.",
      en: "A familiar Swedish classic for guests looking for something well known and comforting.",
    },
  },
  {
    name: "Boeuf Bourguignon",
    country: { sv: "Frankrike", en: "France" },
    description: {
      sv: "En fransk långkoksklassiker för den som hellre väljer en mustig kötträtt.",
      en: "A French slow-cooked classic for guests who prefer a rich meat dish.",
    },
  },
  {
    name: "Fish & Chips",
    country: { sv: "Storbritannien", en: "United Kingdom" },
    description: {
      sv: "En brittisk favorit som breddar urvalet utan att göra specialmenyn för stor.",
      en: "A British favourite that broadens the selection without making the special menu too large.",
    },
  },
] as const;

const galleryImages = [
  {
    src: pastaImage,
    alt: { sv: "Pastarätter från Doni’s", en: "Pasta dishes from Doni’s" },
    wide: true,
  },
  {
    src: assetBase + "/2025/06/donis-mare-mare.jpg",
    alt: { sv: "Pizza Mare mare", en: "Mare mare pizza" },
    wide: false,
  },
  {
    src: assetBase + "/2025/06/donis-diavola.jpg",
    alt: { sv: "Pizza Diavola", en: "Diavola pizza" },
    wide: false,
  },
  {
    src: assetBase + "/2025/06/donis-fettuccini-donis.jpg",
    alt: { sv: "Fettuccini Donis", en: "Fettuccini Donis" },
    wide: false,
  },
  {
    src: assetBase + "/2025/06/donis-vegetariana.jpg",
    alt: { sv: "Pizza Vegetariana", en: "Vegetariana pizza" },
    wide: false,
  },
] as const;

const hours = [
  { day: { sv: "Måndag–torsdag", en: "Monday–Thursday" }, time: "10:30–21:00" },
  { day: { sv: "Fredag", en: "Friday" }, time: "10:30–22:00" },
  { day: { sv: "Lördag", en: "Saturday" }, time: "12:00–22:00" },
  { day: { sv: "Söndag", en: "Sunday" }, time: "12:00–21:00" },
] as const;

const initialPrices: Record<string, string> = Object.fromEntries(
  menuDishes.map((dish) => [dish.name, ""]),
);

export function DonisTrattoriaExperience() {
  const [lang, setLang] = useState<Lang>("sv");
  const [adminOpen, setAdminOpen] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [heroImage, setHeroImage] = useState(defaultHeroImage);
  const [heroTitle, setHeroTitle] = useState<Record<Lang, string>>({
    sv: copy.sv.heroTitle,
    en: copy.en.heroTitle,
  });
  const [aboutText, setAboutText] = useState<Record<Lang, string>>({
    sv: copy.sv.aboutText,
    en: copy.en.aboutText,
  });
  const [prices, setPrices] = useState<Record<string, string>>(initialPrices);

  const c = copy[lang];

  const onHeroUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setHeroImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyDemoChanges = () => {
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2200);
    setAdminOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f3eb] text-[#1d1b18] selection:bg-[#9c2f25] selection:text-white">
      <div className="sticky top-0 z-[80] flex min-h-10 items-center justify-between gap-3 bg-[#15120f] px-4 py-2 text-white sm:px-6">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/50">
          {c.preview}
        </p>
        <button
          type="button"
          onClick={() => setAdminOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70 transition hover:border-white/35 hover:text-white"
        >
          <PencilLine className="h-3.5 w-3.5" />
          {c.adminPreview}
        </button>
      </div>

      <main>
        <section id="top" className="relative min-h-[760px] overflow-hidden bg-[#17130f] text-white sm:min-h-[820px]">
          <img
            src={heroImage}
            alt="Doni’s Trattoria"
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/25 to-black/80" />

          <div className="relative z-10 mx-auto flex min-h-[760px] max-w-[1420px] flex-col px-5 sm:min-h-[820px] sm:px-8 lg:px-10">
            <header className="flex items-center justify-between gap-4 border-b border-white/15 py-5">
              <div className="lg:hidden">
                <details className="group relative">
                  <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border border-white/20 bg-black/20 backdrop-blur [&::-webkit-details-marker]:hidden">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">{c.menuOpen}</span>
                  </summary>
                  <nav className="absolute left-0 top-14 w-60 border border-white/10 bg-[#1b1713]/95 p-2 shadow-2xl backdrop-blur-xl">
                    {navItems.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        className="block border-b border-white/10 px-4 py-3 text-sm font-semibold last:border-0"
                      >
                        {c.nav[item.key]}
                      </a>
                    ))}
                  </nav>
                </details>
              </div>

              <a href="#top" className="min-w-0 text-center lg:text-left">
                <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/60">
                  {c.restaurant}
                </p>
                <p className="mt-1 truncate font-serif text-2xl font-semibold uppercase tracking-[-0.03em] sm:text-3xl">
                  Doni’s Trattoria
                </p>
              </a>

              <nav className="hidden items-center gap-7 lg:flex">
                {navItems.slice(1).map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="text-xs font-bold uppercase tracking-[0.13em] text-white/65 transition hover:text-white"
                  >
                    {c.nav[item.key]}
                  </a>
                ))}
              </nav>

              <div className="flex items-center rounded-full border border-white/20 bg-black/20 p-1 backdrop-blur">
                <Languages className="ml-2 h-3.5 w-3.5 text-white/55" />
                {(["sv", "en"] as Lang[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLang(option)}
                    aria-pressed={lang === option}
                    className={
                      "rounded-full px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition " +
                      (lang === option ? "bg-white text-black" : "text-white/55 hover:text-white")
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </header>

            <div className="mt-auto max-w-[860px] pb-14 pt-24 sm:pb-20">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f0cf9d] sm:text-xs">
                {c.heroEyebrow}
              </p>
              <h1 className="mt-5 max-w-[820px] font-serif text-6xl font-medium leading-[0.92] tracking-[-0.055em] sm:text-7xl lg:text-[92px]">
                {heroTitle[lang]}
              </h1>
              <p className="mt-6 max-w-[680px] text-base font-medium leading-7 text-white/72 sm:text-lg sm:leading-8">
                {c.heroText}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#meny"
                  className="inline-flex items-center gap-2 rounded-full bg-[#f4e3c4] px-5 py-3 text-sm font-black text-[#1d1813] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  {c.seeMenu}
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:border-white/60"
                >
                  <CalendarDays className="h-4 w-4" />
                  {c.bookGoogle}
                  <ExternalLink className="h-3.5 w-3.5 text-white/55" />
                </a>
                <a
                  href={orderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-5 py-3 text-sm font-black text-white backdrop-blur transition hover:border-white/60"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {c.orderOnline}
                  <ExternalLink className="h-3.5 w-3.5 text-white/55" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="om" className="bg-[#f7f3eb] px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto grid max-w-[1220px] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.23em] text-[#9b5c45]">
                {c.aboutEyebrow}
              </p>
              <h2 className="mt-4 max-w-md font-serif text-5xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-6xl">
                {c.aboutTitle}
              </h2>
            </div>

            <div className="font-serif text-xl leading-[1.7] text-[#332d27] sm:text-2xl">
              <p>{aboutText[lang]}</p>
              <p className="mt-6 text-[17px] leading-8 text-black/58 sm:text-lg">
                {c.aboutText2}
              </p>

              <div className="mt-10 flex flex-wrap border-y border-black/12">
                {[c.family, c.waterfront, c.bilingual].map((item) => (
                  <span
                    key={item}
                    className="border-r border-black/12 px-4 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-black/55 first:pl-0 last:border-r-0"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#7c2f28] px-5 py-20 text-[#fff8ef] sm:px-8 sm:py-24">
          <div className="absolute -right-16 -top-28 font-serif text-[260px] leading-none text-white/[0.035] sm:text-[360px]">
            EU
          </div>
          <div className="relative mx-auto max-w-[1220px]">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f3c9b8]">
              {c.europeEyebrow}
            </p>
            <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <h2 className="font-serif text-6xl font-medium leading-[0.92] tracking-[-0.05em] sm:text-7xl">
                {c.europeTitle}
              </h2>
              <div>
                <p className="max-w-xl text-base font-medium leading-7 text-white/72">
                  {c.europeText}
                </p>
                <a
                  href="#europa"
                  className="mt-6 inline-flex items-center gap-2 border-b border-white/45 pb-1 text-xs font-black uppercase tracking-[0.16em] text-white"
                >
                  {c.discover}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="meny" className="bg-[#eee7db] px-5 py-20 sm:px-8 sm:py-28">
          <div className="mx-auto max-w-[1220px]">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.23em] text-[#9b5c45]">
                {c.menuEyebrow}
              </p>
              <h2 className="mt-4 font-serif text-5xl font-medium tracking-[-0.045em] sm:text-6xl">
                {c.menuTitle}
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-black/55 sm:text-base">
                {c.menuText}
              </p>
            </div>

            <div className="mt-12 grid gap-x-12 lg:grid-cols-2">
              {menuDishes.map((dish) => (
                <article
                  key={dish.name}
                  className="grid grid-cols-[90px_1fr] gap-5 border-t border-black/15 py-6 sm:grid-cols-[112px_1fr] sm:gap-7"
                >
                  <img
                    src={dish.image}
                    alt={dish.name}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <div className="flex min-w-0 flex-col justify-center">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#995b44]">
                          {dish.type[lang]}
                        </p>
                        <h3 className="mt-1 font-serif text-2xl sm:text-3xl">{dish.name}</h3>
                      </div>
                      <span className="text-xs font-black text-black/55">
                        {prices[dish.name] || c.priceComing}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-black/48 sm:text-sm sm:leading-6">
                      {dish.description[lang]}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <details
              id="europa"
              className="group mt-12 border-y border-[#7c2f28]/25 bg-[#f7f3eb]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 px-5 py-6 sm:px-8 [&::-webkit-details-marker]:hidden">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b5c45]">
                    {c.europeanMenuLabel}
                  </p>
                  <h3 className="mt-1 font-serif text-3xl sm:text-4xl">{c.europeTitle}</h3>
                  <p className="mt-2 text-xs leading-5 text-black/48 sm:text-sm">
                    {c.europeanMenuIntro}
                  </p>
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-black/15">
                  <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
                </span>
              </summary>

              <div className="grid border-t border-black/10 sm:grid-cols-2">
                {europeanDishes.map((dish, index) => (
                  <article
                    key={dish.name}
                    className={
                      "p-6 sm:p-8 " +
                      (index % 2 === 0 ? "sm:border-r sm:border-black/10 " : "") +
                      (index < 2 ? "border-b border-black/10" : "")
                    }
                  >
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#9b5c45]">
                      {dish.country[lang]}
                    </p>
                    <h4 className="mt-2 font-serif text-3xl">{dish.name}</h4>
                    <p className="mt-3 max-w-md text-sm leading-6 text-black/52">
                      {dish.description[lang]}
                    </p>
                    <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-black/42">
                      {c.pairing}: {c.pairingPending}
                    </p>
                  </article>
                ))}
              </div>
            </details>
          </div>
        </section>

        <section id="galleri" className="bg-[#17130f] px-0 py-0 text-white">
          <div className="mx-auto max-w-[1500px] px-5 py-16 sm:px-8 sm:py-20">
            <div className="mb-10 max-w-2xl">
              <p className="text-[10px] font-black uppercase tracking-[0.23em] text-[#d3aa85]">
                {c.galleryEyebrow}
              </p>
              <h2 className="mt-4 font-serif text-5xl font-medium tracking-[-0.04em] sm:text-6xl">
                {c.galleryTitle}
              </h2>
              <p className="mt-5 text-sm leading-7 text-white/50 sm:text-base">
                {c.galleryText}
              </p>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
              {galleryImages.map((image) => (
                <figure
                  key={image.src}
                  className={
                    "relative overflow-hidden " +
                    (image.wide
                      ? "min-h-[360px] sm:col-span-2 sm:min-h-[520px]"
                      : "min-h-[260px]")
                  }
                >
                  <img
                    src={image.src}
                    alt={image.alt[lang]}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 hover:scale-[1.025]"
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f7f3eb] px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[1080px] border-y border-black/12 py-12 text-center sm:py-16">
            <UtensilsCrossed className="mx-auto h-6 w-6 text-[#9b5c45]" />
            <h2 className="mx-auto mt-5 max-w-3xl font-serif text-4xl font-medium leading-tight tracking-[-0.035em] sm:text-5xl">
              {c.actionTitle}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-black/52 sm:text-base">
              {c.actionText}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#1d1a17] px-5 py-3 text-sm font-black text-white"
              >
                <CalendarDays className="h-4 w-4" />
                {c.bookGoogle}
                <ExternalLink className="h-3.5 w-3.5 text-white/55" />
              </a>
              <a
                href={orderUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-black/20 px-5 py-3 text-sm font-black text-[#1d1a17]"
              >
                <ShoppingBag className="h-4 w-4" />
                {c.orderOnline}
                <ExternalLink className="h-3.5 w-3.5 text-black/45" />
              </a>
            </div>
          </div>
        </section>

        <section id="kontakt" className="bg-[#26211c] px-5 py-20 text-white sm:px-8 sm:py-24">
          <div className="mx-auto grid max-w-[1120px] gap-14 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.23em] text-[#d0a984]">
                {c.visit}
              </p>
              <h2 className="mt-4 font-serif text-5xl font-medium">Doni’s Trattoria</h2>

              <div className="mt-8 space-y-5 text-sm leading-7 text-white/66">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-3 transition hover:text-white"
                >
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#d0a984]" />
                  <span>
                    Hornsbergs Strand 77
                    <br />
                    112 16 Stockholm
                  </span>
                </a>
                <a
                  href="tel:+4686568400"
                  className="flex items-center gap-3 transition hover:text-white"
                >
                  <Phone className="h-4 w-4 text-[#d0a984]" />
                  08-656 84 00
                </a>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 transition hover:text-white"
                >
                  <Camera className="h-4 w-4 text-[#d0a984]" />
                  @donistrattoriahornsbergsstrand
                </a>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-[#d0a984]" />
                <h3 className="font-serif text-4xl">{c.hours}</h3>
              </div>
              <div className="mt-7 divide-y divide-white/10">
                {hours.map((item) => (
                  <div
                    key={item.time + item.day.sv}
                    className="flex items-center justify-between gap-4 py-4 text-sm"
                  >
                    <span className="text-white/55">{item.day[lang]}</span>
                    <span className="font-bold">{item.time}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-white/35">{c.currentInfo}</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="flex flex-col items-center justify-between gap-3 bg-[#15120f] px-5 py-6 text-[9px] font-bold uppercase tracking-[0.18em] text-white/35 sm:flex-row sm:px-8">
        <span>Doni’s Trattoria · concept by Proffera</span>
        <span>Stockholm · Hornsbergs Strand</span>
      </footer>

      {showSaved ? (
        <div className="fixed bottom-5 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#173c28] px-5 py-3 text-xs font-bold text-white shadow-2xl">
          <Check className="h-4 w-4" />
          {c.demoSaved}
        </div>
      ) : null}

      {adminOpen ? (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/60 backdrop-blur-sm">
          <button
            type="button"
            aria-label={c.close}
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setAdminOpen(false)}
          />
          <aside className="relative z-10 h-full w-full max-w-xl overflow-y-auto bg-[#f7f3eb] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-[#f7f3eb]/95 px-5 py-4 backdrop-blur sm:px-7">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#9b5c45]">
                  {c.adminPreview}
                </p>
                <h2 className="mt-1 font-serif text-3xl">{c.editDemo}</h2>
              </div>
              <button
                type="button"
                onClick={() => setAdminOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-black/10 bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-7">
              <p className="rounded-2xl border border-[#b07b61]/20 bg-[#efe0d4] p-4 text-xs font-semibold leading-6 text-[#654c3d]">
                {c.adminIntro}
              </p>

              <div className="mt-6">
                <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-black/50">
                  <Globe2 className="h-4 w-4" />
                  {c.language}
                </p>
                <div className="inline-flex rounded-full border border-black/12 bg-white p-1">
                  {(["sv", "en"] as Lang[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setLang(option)}
                      className={
                        "rounded-full px-4 py-2 text-xs font-black uppercase " +
                        (lang === option ? "bg-[#1d1a17] text-white" : "text-black/45")
                      }
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mt-7 block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-black/50">
                  {c.editHero}
                </span>
                <input
                  value={heroTitle[lang]}
                  onChange={(event) =>
                    setHeroTitle((current) => ({
                      ...current,
                      [lang]: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-black/12 bg-white px-4 py-3.5 text-sm font-semibold outline-none focus:border-[#9b5c45]"
                />
              </label>

              <label className="mt-5 block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em] text-black/50">
                  {c.editAbout}
                </span>
                <textarea
                  rows={6}
                  value={aboutText[lang]}
                  onChange={(event) =>
                    setAboutText((current) => ({
                      ...current,
                      [lang]: event.target.value,
                    }))
                  }
                  className="w-full resize-none rounded-2xl border border-black/12 bg-white px-4 py-3.5 text-sm font-semibold leading-6 outline-none focus:border-[#9b5c45]"
                />
              </label>

              <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-black/50">
                  <ImagePlus className="h-4 w-4" />
                  {c.uploadHero}
                </p>
                <p className="mt-2 text-xs leading-5 text-black/45">{c.uploadHelp}</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onHeroUpload}
                  className="mt-4 block w-full text-xs font-semibold file:mr-3 file:rounded-full file:border-0 file:bg-[#1d1a17] file:px-4 file:py-2.5 file:text-xs file:font-black file:text-white"
                />
              </div>

              <div className="mt-7">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-black/50">
                  {c.editPrices}
                </p>
                <div className="mt-3 divide-y divide-black/8 rounded-2xl border border-black/10 bg-white px-4">
                  {menuDishes.map((dish) => (
                    <label
                      key={dish.name}
                      className="grid grid-cols-[1fr_120px] items-center gap-3 py-3"
                    >
                      <span className="text-xs font-bold">{dish.name}</span>
                      <input
                        value={prices[dish.name]}
                        onChange={(event) =>
                          setPrices((current) => ({
                            ...current,
                            [dish.name]: event.target.value,
                          }))
                        }
                        placeholder={c.pricePlaceholder}
                        className="w-full rounded-xl border border-black/10 bg-[#faf8f3] px-3 py-2 text-right text-xs font-bold outline-none focus:border-[#9b5c45]"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-7 border-t border-black/10 pt-6">
                <p className="text-xs font-black">{c.adminCapabilities}</p>
                <ul className="mt-3 space-y-2">
                  {c.capabilityList.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs leading-5 text-black/55">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6c7b50]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={applyDemoChanges}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1d1a17] px-5 py-4 text-sm font-black text-white"
              >
                <Save className="h-4 w-4" />
                {c.apply}
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
