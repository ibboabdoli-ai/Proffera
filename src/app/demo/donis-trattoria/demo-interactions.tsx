"use client";

import { useEffect, useState } from "react";
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
const labels = {
  sv: {
    about: "Om oss",
    menu: "Meny",
    gallery: "Galleri",
    contact: "Kontakt",
    view: "Se menyn",
    book: "Boka bord",
    order: "Beställ online",
    visit: "Besök oss",
    hours: "Öppettider",
    closed: "Stängt",
    call: "Kontakta oss för aktuella öppettider",
    noMenu:
      "Menyn publiceras snart. Kontakta restaurangen för aktuella rätter och priser.",
    europe: "En smak av Europa",
    sampleMenu:
      "Ett urval från Doni’s tidigare presentation. Aktuell meny och priser uppdateras av restaurangen.",
  },
  en: {
    about: "About",
    menu: "Menu",
    gallery: "Gallery",
    contact: "Contact",
    view: "View menu",
    book: "Book a table",
    order: "Order online",
    visit: "Visit us",
    hours: "Opening hours",
    closed: "Closed",
    call: "Contact us for current opening hours",
    noMenu:
      "The menu will be published soon. Contact the restaurant for current dishes and prices.",
    europe: "A taste of Europe",
    sampleMenu:
      "A selection from Doni’s previous presentation. The restaurant maintains the current menu and prices.",
  },
};
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

export function DonisTrattoriaExperience({
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
  const t = labels[lang];
  const isFallback = site === null;
  const displaySite = site ?? DONIS_FALLBACK_SITE;
  const displayImages = isFallback ? DONIS_FALLBACK_IMAGES : images;
  const dishes = (categoryId: string) =>
    [...displaySite.dishes]
      .filter(
        (dish) =>
          dish.categoryId === categoryId &&
          !dish.hidden &&
          !dish.archived &&
          (isFallback || dish.priceOre !== null),
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  const categories = [...displaySite.categories]
    .filter((item) => !item.hidden && dishes(item.id).length)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const europe = categories.find(
    (category) => category.name.sv.trim().toLowerCase() === "en smak av europa",
  );
  const mainCategories = categories.filter(
    (category) => category.id !== europe?.id,
  );
  const gallery = [...displaySite.media.gallery]
    .filter(
      (item) =>
        displayImages[item.id] &&
        !displaySite.dishes.some((dish) => dish.image?.id === item.id),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const hero =
    displaySite.media.hero && displayImages[displaySite.media.hero.id]
      ? displayImages[displaySite.media.hero.id]
      : heroFallback;
  const booking = displaySite.links.booking;
  const order = displaySite.links.order || currentOrderUrl;
  const text = displaySite.text;

  function dishList(categoryId: string) {
    return (
      <div className="mt-5 grid gap-x-12 md:grid-cols-2">
        {dishes(categoryId).map((dish) => (
          <article
            key={dish.id}
            className="flex gap-4 border-t border-black/15 py-5"
          >
            {dish.image && displayImages[dish.image.id] && (
              <img
                src={displayImages[dish.image.id]}
                alt={dish.image.alt[lang]}
                loading="lazy"
                className="h-20 w-20 shrink-0 object-cover sm:h-24 sm:w-24"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="font-serif text-xl sm:text-2xl">{dish.name}</h4>
                {dish.priceOre !== null && (
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {(dish.priceOre / 100).toLocaleString(
                      lang === "sv" ? "sv-SE" : "en-SE",
                      { maximumFractionDigits: 2 },
                    )}{" "}
                    kr
                  </span>
                )}
              </div>
              {dish.description[lang] && (
                <p className="mt-2 text-sm leading-6 text-[#534b44]">
                  {dish.description[lang]}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div
      lang={lang}
      className="min-h-screen bg-[#f7f3eb] text-[#211d19] selection:bg-[#9c2f25] selection:text-white"
    >
      <section
        id="top"
        className="relative flex min-h-[680px] flex-col overflow-hidden bg-[#17130f] text-white sm:min-h-[790px]"
      >
        <img
          src={hero}
          alt={displaySite.media.hero?.alt[lang] || "Doni’s Trattoria"}
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/30 to-black/80" />
        <header className="relative z-10 mx-auto grid w-full max-w-[1380px] grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-white/20 px-5 py-5 sm:px-9">
          <a
            href="#top"
            aria-label="Doni’s Trattoria"
            className="relative z-20 flex min-h-14 shrink-0 items-center gap-3 rounded-2xl bg-[#f6ead6] px-3 py-2 text-[#211d19] shadow-lg ring-1 ring-black/10"
          >
            <img
              src="/donis-logo.png"
              alt="Doni’s Trattoria"
              className="h-11 w-[106px] shrink-0 object-contain brightness-0 sm:h-12 sm:w-[116px]"
            />
            <span
              aria-hidden="true"
              className="hidden font-serif text-lg font-semibold tracking-tight text-[#211d19] sm:inline sm:text-xl"
            >
              Doni’s Trattoria
            </span>
          </a>
          <nav
            aria-label={lang === "sv" ? "Huvudmeny" : "Main menu"}
            className="col-span-3 row-start-2 flex w-full justify-center gap-5 overflow-x-auto text-xs font-bold uppercase tracking-widest text-white/85 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:w-auto"
          >
            <a className="min-h-11 shrink-0 py-3" href="#om">
              {t.about}
            </a>
            <a className="min-h-11 shrink-0 py-3" href="#meny">
              {t.menu}
            </a>
            {gallery.length > 0 && (
              <a className="min-h-11 shrink-0 py-3" href="#galleri">
                {t.gallery}
              </a>
            )}
            <a className="min-h-11 shrink-0 py-3" href="#kontakt">
              {t.contact}
            </a>
          </nav>
          <div
            className="col-start-3 row-start-1 flex justify-self-end rounded-full border border-white/40 p-1"
            aria-label={lang === "sv" ? "Språk" : "Language"}
          >
            {(["sv", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLang(option)}
                aria-pressed={lang === option}
                className={`min-h-9 min-w-10 rounded-full text-xs font-bold uppercase ${lang === option ? "bg-white text-[#211d19]" : "text-white"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </header>
        <div className="relative z-10 mx-auto mt-auto w-full max-w-[1380px] px-5 pb-16 pt-24 sm:px-9 sm:pb-24">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#f0cf9d]">
            Doni’s Trattoria · Stockholm
          </p>
          <h1 className="mt-5 max-w-[850px] font-serif text-6xl leading-[0.96] tracking-[-0.05em] sm:text-7xl lg:text-[92px]">
            {text?.heroTitle[lang] || "Doni’s Trattoria"}
          </h1>
          {text?.heroDescription[lang] && (
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 sm:text-lg">
              {text.heroDescription[lang]}
            </p>
          )}
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href="#meny"
              className="inline-flex min-h-12 items-center rounded-full bg-[#f4e3c4] px-6 text-sm font-bold text-[#211d19]"
            >
              {t.view} →
            </a>
            {booking && (
              <a
                href={booking}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center rounded-full border border-white/65 px-6 text-sm font-bold text-white"
              >
                {t.book}
              </a>
            )}
            {order && (
              <a
                href={order}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center rounded-full border border-white/65 px-6 text-sm font-bold text-white"
              >
                {t.order}
              </a>
            )}
          </div>
        </div>
      </section>
      <section
        id="om"
        className="mx-auto grid max-w-[1220px] gap-10 px-5 py-20 sm:px-9 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#9b5c45]">
            {t.about}
          </p>
          <h2 className="mt-4 font-serif text-5xl leading-none tracking-tight sm:text-6xl">
            {text?.aboutTitle[lang] || t.about}
          </h2>
        </div>
        <div className="max-w-2xl">
          <p className="font-serif text-xl leading-relaxed sm:text-2xl">
            {text?.story[lang]}
          </p>
          {text?.ownerIntroduction[lang] && (
            <p className="mt-6 leading-7">{text.ownerIntroduction[lang]}</p>
          )}
          {text?.philosophy[lang] && (
            <p className="mt-6 leading-7">{text.philosophy[lang]}</p>
          )}
          {text?.foundedYear && (
            <p className="mt-5 text-sm font-bold">{text.foundedYear}</p>
          )}
          {displaySite.media.family && displayImages[displaySite.media.family.id] && (
            <img
              src={displayImages[displaySite.media.family.id]}
              alt={displaySite.media.family.alt[lang]}
              className="mt-8 max-h-96 w-full object-cover"
            />
          )}
          {displaySite.media.owner && displayImages[displaySite.media.owner.id] && (
            <img
              src={displayImages[displaySite.media.owner.id]}
              alt={displaySite.media.owner.alt[lang]}
              className="mt-5 max-h-72 w-full object-cover"
            />
          )}
        </div>
      </section>
      <section id="meny" className="bg-[#eee7db] px-5 py-20 sm:px-9 sm:py-28">
        <div className="mx-auto max-w-[1220px]">
          <p className="text-xs font-bold uppercase tracking-widest text-[#9b5c45]">
            Doni’s Trattoria
          </p>
          <h2 className="mt-4 font-serif text-5xl sm:text-6xl">{t.menu}</h2>
          {isFallback && (
            <p className="mt-5 max-w-2xl text-sm leading-6 text-[#655b51]">
              {t.sampleMenu}
            </p>
          )}
          {mainCategories.length > 2 && (
            <nav
              aria-label={lang === "sv" ? "Meny-kategorier" : "Menu categories"}
              className="mt-8 flex gap-5 overflow-x-auto border-y border-black/15 py-3"
            >
              {mainCategories.map((category) => (
                <a
                  key={category.id}
                  className="min-h-11 shrink-0 py-3 text-sm font-bold underline-offset-4 hover:underline"
                  href={`#category-${category.id}`}
                >
                  {category.name[lang] || category.name.sv}
                </a>
              ))}
            </nav>
          )}
          {!categories.length && <p className="mt-8 text-base">{t.noMenu}</p>}
          {mainCategories.map((category) => (
            <div
              id={`category-${category.id}`}
              key={category.id}
              className="scroll-mt-8 border-b border-black/20 py-10"
            >
              <h3 className="font-serif text-3xl sm:text-4xl">
                {category.name[lang] || category.name.sv}
              </h3>
              {dishList(category.id)}
            </div>
          ))}
          {europe && (
            <details
              id="europa"
              className="mt-10 border-y border-[#7c2f28]/35 bg-[#f7f3eb]"
            >
              <summary className="flex min-h-20 cursor-pointer items-center justify-between gap-4 px-5 py-5 font-serif text-3xl">
                {europe.name[lang] || t.europe}
                <span className="text-lg">⌄</span>
              </summary>
              <div className="px-5 pb-5">{dishList(europe.id)}</div>
            </details>
          )}
        </div>
      </section>
      {gallery.length > 0 && (
        <section
          id="galleri"
          className="bg-[#17130f] px-5 py-20 text-white sm:px-9 sm:py-24"
        >
          <div className="mx-auto max-w-[1220px]">
            <p className="text-xs font-bold uppercase tracking-widest text-[#d3aa85]">
              {t.gallery}
            </p>
            <h2 className="mt-4 font-serif text-5xl">Doni’s Trattoria</h2>
            <div className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((item, index) => (
                <figure
                  key={`${item.id}-${index}`}
                  className={`overflow-hidden ${index === 0 ? "sm:col-span-2 sm:row-span-2" : ""}`}
                >
                  <img
                    src={displayImages[item.id]}
                    alt={item.alt[lang]}
                    loading="lazy"
                    className="aspect-[4/3] h-full w-full object-cover"
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}
      {(booking || order) && (
        <section className="px-5 py-20 sm:px-9">
          <div className="mx-auto max-w-[1000px] border-y border-black/15 py-14 text-center">
            <h2 className="font-serif text-4xl">{t.visit}</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {booking && (
                <a
                  className="inline-flex min-h-12 items-center rounded-full bg-[#211d19] px-6 text-sm font-bold text-white"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={booking}
                >
                  {t.book} ↗
                </a>
              )}
              {order && (
                <a
                  className="inline-flex min-h-12 items-center rounded-full border border-[#211d19] px-6 text-sm font-bold text-[#211d19]"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={order}
                >
                  {t.order} ↗
                </a>
              )}
            </div>
          </div>
        </section>
      )}
      <section
        id="kontakt"
        className="bg-[#26211c] px-5 py-20 text-white sm:px-9 sm:py-24"
      >
        <div className="mx-auto grid max-w-[1120px] gap-12 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#d0a984]">
              {t.visit}
            </p>
            <h2 className="mt-4 font-serif text-4xl">Doni’s Trattoria</h2>
            <address className="mt-7 grid gap-4 not-italic text-white/85">
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                Hornsbergs Strand 77
                <br />
                112 16 Stockholm ↗
              </a>
              <a href="tel:+4686568400">08-656 84 00</a>
              <a href="mailto:donitrattoria@gmail.com">
                donitrattoria@gmail.com
              </a>
              <a
                href="https://www.instagram.com/donistrattoriahornsbergsstrand/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram ↗
              </a>
            </address>
          </div>
          <div>
            <h3 className="font-serif text-3xl">{t.hours}</h3>
            {displaySite.hours.some((hour) => !hour.closed) ? (
              <div className="mt-5 divide-y divide-white/15">
                {displaySite.hours.map((hour) => (
                  <div
                    key={hour.day}
                    className="flex justify-between gap-4 py-3 text-sm"
                  >
                    <span>{days[lang][hour.day]}</span>
                    <span className="font-bold tabular-nums">
                      {hour.closed ? t.closed : `${hour.open}–${hour.close}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-white/80">{t.call}</p>
            )}
          </div>
        </div>
      </section>
      <footer className="bg-[#15120f] px-5 py-6 text-xs text-white/70 sm:px-9">
        <div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-2">
          <span>Doni’s Trattoria · Stockholm</span>
          <span>Org.nr 556852-1420</span>
        </div>
      </footer>
    </div>
  );
}
