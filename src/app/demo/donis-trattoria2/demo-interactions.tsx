"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DONIS_FALLBACK_IMAGES,
  DONIS_FALLBACK_SITE,
} from "@/lib/donis-fallback";
import type { RestaurantSite } from "@/lib/restaurant-site-schema";

type Lang = "sv" | "en";

const heroFallback =
  "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/05/donis-pizzorny.jpg";
const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=Doni%27s+Trattoria+Hornsbergs+Strand+77+Stockholm";
const currentOrderUrl =
  "https://qopla.com/restaurant/doni-trattoria-italiana/qyZkGvbq9M/order";

const copy = {
  sv: {
    about: "Om oss",
    menu: "Meny",
    gallery: "Galleri",
    contact: "Kontakt",
    viewMenu: "Utforska menyn",
    order: "Beställ online",
    book: "Boka bord",
    featured: "Utvalda favoriter",
    featuredKicker: "Från köket",
    menuKicker: "Doni’s Trattoria",
    menuIntro:
      "Ett urval från Doni’s tidigare presentation. Aktuell meny och priser uppdateras av restaurangen.",
    experience: "Italienska smaker vid Hornsbergs Strand",
    galleryTitle: "Smaker, stämning & detaljer",
    visit: "Besök oss",
    hours: "Öppettider",
    closed: "Stängt",
    follow: "Följ oss",
    directions: "Öppna i Google Maps",
    noMenu:
      "Menyn publiceras snart. Kontakta restaurangen för aktuella rätter och priser.",
    sampleLabel: "Exempel från nuvarande presentation",
  },
  en: {
    about: "About",
    menu: "Menu",
    gallery: "Gallery",
    contact: "Contact",
    viewMenu: "Explore the menu",
    order: "Order online",
    book: "Book a table",
    featured: "Selected favourites",
    featuredKicker: "From the kitchen",
    menuKicker: "Doni’s Trattoria",
    menuIntro:
      "A selection from Doni’s previous presentation. The restaurant maintains the current menu and prices.",
    experience: "Italian flavours by Hornsbergs Strand",
    galleryTitle: "Flavour, atmosphere & detail",
    visit: "Visit us",
    hours: "Opening hours",
    closed: "Closed",
    follow: "Follow us",
    directions: "Open in Google Maps",
    noMenu:
      "The menu will be published soon. Contact the restaurant for current dishes and prices.",
    sampleLabel: "Examples from the current presentation",
  },
} as const;

const days = {
  sv: ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"],
  en: [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ],
};

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0px)" : "translateY(28px)",
        transition: `opacity 700ms ease ${delay}ms, transform 700ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export function DonisTrattoriaLuxuryExperience({
  site,
  images = {},
}: {
  site: RestaurantSite | null;
  images?: Record<string, string>;
}) {
  const [lang, setLang] = useState<Lang>("sv");

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);

  const t = copy[lang];
  const isFallback = site === null;
  const displaySite = site ?? DONIS_FALLBACK_SITE;
  const displayImages = isFallback ? DONIS_FALLBACK_IMAGES : images;

  const visibleDishes = [...displaySite.dishes]
    .filter(
      (dish) =>
        !dish.hidden &&
        !dish.archived &&
        (isFallback || dish.priceOre !== null),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const dishesByCategory = (categoryId: string) =>
    visibleDishes
      .filter((dish) => dish.categoryId === categoryId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const categories = [...displaySite.categories]
    .filter(
      (category) =>
        !category.hidden && dishesByCategory(category.id).length > 0,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const gallery = [...displaySite.media.gallery]
    .filter((item) => Boolean(displayImages[item.id]))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const hero =
    displaySite.media.hero && displayImages[displaySite.media.hero.id]
      ? displayImages[displaySite.media.hero.id]
      : heroFallback;

  const booking = displaySite.links.booking;
  const order = displaySite.links.order || currentOrderUrl;
  const text = displaySite.text;

  const featured = visibleDishes
    .filter((dish) => dish.image && displayImages[dish.image.id])
    .slice(0, 3);

  function formatPrice(priceOre: number | null) {
    if (priceOre === null) return null;
    return `${(priceOre / 100).toLocaleString(
      lang === "sv" ? "sv-SE" : "en-SE",
      { maximumFractionDigits: 2 },
    )} kr`;
  }

  return (
    <div
      lang={lang}
      className="min-h-screen overflow-x-hidden bg-[#090909] text-[#f5efe6] selection:bg-[#d4a35f] selection:text-black"
    >
      <section id="top" className="relative min-h-[760px] overflow-hidden">
        <img
          src={hero}
          alt={displaySite.media.hero?.alt[lang] || "Doni’s Trattoria"}
          className="absolute inset-0 h-full w-full object-cover scale-[1.02]"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.72)_0%,rgba(0,0,0,.32)_35%,rgba(0,0,0,.82)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_48%,rgba(190,129,55,.18),transparent_36%)]" />

        <header className="relative z-20 mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-5 sm:px-8 lg:px-12">
          <a
            href="#top"
            aria-label="Doni’s Trattoria"
            className="flex items-center gap-3"
          >
            <span
              className="block h-12 w-24 rounded-xl bg-[#efe0c3] sm:h-14 sm:w-28"
              style={{
                backgroundImage: "url('/donis-logo.png')",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "84% auto",
              }}
              aria-hidden="true"
            />
            <span className="hidden sm:block">
              <span className="block font-serif text-lg leading-none tracking-tight">
                Doni’s
              </span>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.28em] text-[#d4a35f]">
                Trattoria
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-[11px] font-bold uppercase tracking-[0.16em] text-white/80 lg:flex">
            <a className="transition hover:text-[#d4a35f]" href="#om">
              {t.about}
            </a>
            <a className="transition hover:text-[#d4a35f]" href="#meny">
              {t.menu}
            </a>
            {gallery.length > 0 && (
              <a className="transition hover:text-[#d4a35f]" href="#galleri">
                {t.gallery}
              </a>
            )}
            <a className="transition hover:text-[#d4a35f]" href="#kontakt">
              {t.contact}
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-white/25 bg-black/20 p-1 backdrop-blur">
              {(["sv", "en"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLang(option)}
                  aria-pressed={lang === option}
                  className={`min-h-9 min-w-10 rounded-full text-[10px] font-bold uppercase transition ${
                    lang === option
                      ? "bg-[#efe0c3] text-[#17120c]"
                      : "text-white/80"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {order && (
              <a
                href={order}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden min-h-11 items-center rounded-full bg-[#d4a35f] px-5 text-xs font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#e2ba7a] sm:inline-flex"
              >
                {t.order}
              </a>
            )}
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[650px] max-w-[1400px] items-end px-4 pb-24 sm:px-8 lg:px-12 lg:pb-28">
          <div className="grid w-full items-end gap-10 lg:grid-cols-[1fr_360px]">
            <div className="max-w-4xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#d4a35f] sm:text-xs">
                Doni’s Trattoria · Stockholm
              </p>
              <h1 className="mt-4 max-w-4xl font-serif text-[54px] leading-[0.92] tracking-[-0.05em] text-white sm:text-7xl lg:text-[104px]">
                {text.heroTitle[lang] || "Doni’s Trattoria"}
              </h1>
              {text.heroDescription[lang] && (
                <p className="mt-6 max-w-2xl text-base leading-8 text-white/75 sm:text-lg">
                  {text.heroDescription[lang]}
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#meny"
                  className="inline-flex min-h-12 items-center rounded-full bg-[#d4a35f] px-6 text-sm font-black text-[#17120c] transition hover:-translate-y-0.5 hover:bg-[#e2ba7a]"
                >
                  {t.viewMenu} →
                </a>
                {booking && (
                  <a
                    href={booking}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center rounded-full border border-white/40 bg-black/10 px-6 text-sm font-bold text-white backdrop-blur transition hover:border-[#d4a35f] hover:text-[#e9c994]"
                  >
                    {t.book}
                  </a>
                )}
                {order && (
                  <a
                    href={order}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center rounded-full border border-white/40 bg-black/10 px-6 text-sm font-bold text-white backdrop-blur transition hover:border-[#d4a35f] hover:text-[#e9c994] sm:hidden"
                  >
                    {t.order}
                  </a>
                )}
              </div>
            </div>

            <div className="hidden rounded-[28px] border border-white/10 bg-black/45 p-5 backdrop-blur-xl lg:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4a35f]">
                {t.experience}
              </p>
              <div className="mt-4 divide-y divide-white/10">
                {displaySite.hours.slice(0, 3).map((hour) => (
                  <div
                    key={hour.day}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <span className="text-white/65">{days[lang][hour.day]}</span>
                    <span className="font-bold tabular-nums">
                      {hour.closed ? t.closed : `${hour.open}–${hour.close}`}
                    </span>
                  </div>
                ))}
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex text-xs font-bold text-[#e9c994] underline underline-offset-4"
              >
                Hornsbergs Strand 77 ↗
              </a>
            </div>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="relative z-10 mx-auto -mt-12 max-w-[1180px] px-4 sm:-mt-16 sm:px-8">
          <div className="grid gap-3 rounded-[28px] border border-white/10 bg-[#121212]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:grid-cols-3">
            {featured.map((dish, index) => (
              <Reveal key={dish.id} delay={index * 90}>
                <a
                  href="#meny"
                  className="group grid grid-cols-[92px_1fr] items-center gap-4 rounded-[20px] p-2 transition hover:bg-white/[0.04]"
                >
                  <div className="overflow-hidden rounded-2xl">
                    <img
                      src={displayImages[dish.image!.id]}
                      alt={dish.image!.alt[lang]}
                      className="h-24 w-24 object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#a98b67]">
                      {t.featuredKicker}
                    </p>
                    <h2 className="mt-1 truncate font-serif text-xl text-white">
                      {dish.name}
                    </h2>
                    {formatPrice(dish.priceOre) && (
                      <p className="mt-2 text-xs font-bold text-[#e9c994]">
                        {formatPrice(dish.priceOre)}
                      </p>
                    )}
                  </div>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section id="om" className="px-4 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <Reveal>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d4a35f]">
                {t.about}
              </p>
              <h2 className="mt-5 max-w-lg font-serif text-5xl leading-[0.98] tracking-[-0.035em] sm:text-6xl">
                {text.aboutTitle[lang] || t.about}
              </h2>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="max-w-2xl">
              {text.story[lang] && (
                <p className="font-serif text-2xl leading-[1.45] text-[#f4eadf] sm:text-3xl">
                  {text.story[lang]}
                </p>
              )}
              {text.ownerIntroduction[lang] && (
                <p className="mt-7 max-w-xl leading-7 text-white/60">
                  {text.ownerIntroduction[lang]}
                </p>
              )}
              {text.philosophy[lang] && (
                <p className="mt-5 max-w-xl leading-7 text-white/60">
                  {text.philosophy[lang]}
                </p>
              )}
              <div className="mt-8 h-px w-full bg-white/10" />
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#a98b67]">
                Hornsbergs Strand 77 · Stockholm
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="meny" className="border-y border-white/10 bg-[#0d0d0d] px-4 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[1180px]">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d4a35f]">
                  {t.menuKicker}
                </p>
                <h2 className="mt-4 font-serif text-5xl tracking-[-0.035em] sm:text-7xl">
                  {t.menu}
                </h2>
                {isFallback && (
                  <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">
                    {t.menuIntro}
                  </p>
                )}
              </div>
              {categories.length > 1 && (
                <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                  {categories.map((category) => (
                    <a
                      key={category.id}
                      href={`#luxury-category-${category.id}`}
                      className="shrink-0 rounded-full border border-white/15 px-4 py-2 text-xs font-bold text-white/70 transition hover:border-[#d4a35f] hover:text-[#e9c994]"
                    >
                      {category.name[lang] || category.name.sv}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </Reveal>

          {!categories.length && (
            <p className="mt-12 text-white/60">{t.noMenu}</p>
          )}

          <div className="mt-14 space-y-20">
            {categories.map((category, categoryIndex) => (
              <Reveal key={category.id} delay={categoryIndex * 60}>
                <div
                  id={`luxury-category-${category.id}`}
                  className="scroll-mt-10"
                >
                  <div className="mb-7 flex items-center gap-4">
                    <span className="h-px w-10 bg-[#d4a35f]" />
                    <h3 className="font-serif text-3xl sm:text-4xl">
                      {category.name[lang] || category.name.sv}
                    </h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {dishesByCategory(category.id).map((dish) => {
                      const dishImage =
                        dish.image && displayImages[dish.image.id]
                          ? displayImages[dish.image.id]
                          : null;
                      return (
                        <article
                          key={dish.id}
                          className="group overflow-hidden rounded-[24px] border border-white/10 bg-[#151515] transition duration-300 hover:-translate-y-1 hover:border-[#d4a35f]/50"
                        >
                          {dishImage && (
                            <div className="overflow-hidden">
                              <img
                                src={dishImage}
                                alt={dish.image!.alt[lang]}
                                loading="lazy"
                                className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                              />
                            </div>
                          )}
                          <div className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <h4 className="font-serif text-2xl text-white">
                                {dish.name}
                              </h4>
                              {formatPrice(dish.priceOre) && (
                                <span className="shrink-0 rounded-full bg-[#d4a35f]/10 px-3 py-1 text-xs font-black text-[#e9c994]">
                                  {formatPrice(dish.priceOre)}
                                </span>
                              )}
                            </div>
                            {dish.description[lang] && (
                              <p className="mt-3 text-sm leading-6 text-white/55">
                                {dish.description[lang]}
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {gallery.length > 0 && (
        <section id="galleri" className="px-4 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-[1180px]">
            <Reveal>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d4a35f]">
                {t.gallery}
              </p>
              <h2 className="mt-4 max-w-2xl font-serif text-5xl tracking-[-0.035em] sm:text-6xl">
                {t.galleryTitle}
              </h2>
            </Reveal>
            <div className="mt-10 grid auto-rows-[220px] gap-3 sm:grid-cols-2 lg:grid-cols-12">
              {gallery.slice(0, 6).map((item, index) => {
                const span =
                  index === 0
                    ? "lg:col-span-7 lg:row-span-2"
                    : index === 1
                      ? "lg:col-span-5"
                      : index === 2
                        ? "lg:col-span-5"
                        : "lg:col-span-4";
                return (
                  <Reveal
                    key={`${item.id}-${index}`}
                    className={`overflow-hidden rounded-[24px] ${span}`}
                    delay={index * 60}
                  >
                    <img
                      src={displayImages[item.id]}
                      alt={item.alt[lang]}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 hover:scale-[1.03]"
                    />
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section id="kontakt" className="border-t border-white/10 bg-[#0d0d0d] px-4 py-24 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-[1180px] gap-14 lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#d4a35f]">
                {t.visit}
              </p>
              <h2 className="mt-4 font-serif text-5xl sm:text-6xl">
                Doni’s Trattoria
              </h2>
              <address className="mt-8 grid gap-4 not-italic text-base text-white/65">
                <a
                  className="transition hover:text-[#e9c994]"
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Hornsbergs Strand 77
                  <br />
                  112 16 Stockholm ↗
                </a>
                <a className="transition hover:text-[#e9c994]" href="tel:+4686568400">
                  08-656 84 00
                </a>
                <a
                  className="transition hover:text-[#e9c994]"
                  href="mailto:donitrattoria@gmail.com"
                >
                  donitrattoria@gmail.com
                </a>
                <a
                  className="transition hover:text-[#e9c994]"
                  href="https://www.instagram.com/donis.trattoria/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Instagram ↗
                </a>
              </address>
              <div className="mt-8 flex flex-wrap gap-3">
                {order && (
                  <a
                    href={order}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center rounded-full bg-[#d4a35f] px-6 text-sm font-black text-black"
                  >
                    {t.order}
                  </a>
                )}
                {booking && (
                  <a
                    href={booking}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center rounded-full border border-white/20 px-6 text-sm font-bold text-white"
                  >
                    {t.book}
                  </a>
                )}
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="rounded-[28px] border border-white/10 bg-[#151515] p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-serif text-3xl">{t.hours}</h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a98b67]">
                  Stockholm
                </span>
              </div>
              <div className="mt-6 divide-y divide-white/10">
                {displaySite.hours.map((hour) => (
                  <div
                    key={hour.day}
                    className="flex items-center justify-between gap-4 py-4 text-sm"
                  >
                    <span className="text-white/60">{days[lang][hour.day]}</span>
                    <span className="font-black tabular-nums text-white">
                      {hour.closed ? t.closed : `${hour.open}–${hour.close}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#070707] px-4 py-7 sm:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 text-xs text-white/45">
          <span>Doni’s Trattoria · Stockholm</span>
          <span>Org.nr 556852-1420</span>
        </div>
      </footer>
    </div>
  );
}
