"use client";

import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Heart,
  Camera,
  Mail,
  MapPin,
  Menu,
  Navigation,
  Phone,
  ShoppingBag,
  UtensilsCrossed,
  UsersRound,
  Waves,
  Wine,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DONIS_LUXURY_FALLBACK_IMAGES,
  DONIS_LUXURY_FALLBACK_SITE,
} from "@/lib/donis-luxury-fallback";
import type { RestaurantSite } from "@/lib/restaurant-site-schema";

type Lang = "sv" | "en";
type Dish = RestaurantSite["dishes"][number];
type GalleryKind = RestaurantSite["media"]["gallery"][number]["kind"];

const heroFallback =
  "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/05/donis-pizzorny.jpg";
const mapsUrl =
  "https://www.google.com/maps/search/?api=1&query=Doni%27s+Trattoria+Hornsbergs+Strand+77+Stockholm";
const mapEmbedUrl =
  "https://www.google.com/maps?q=Hornsbergs+Strand+77,+112+16+Stockholm&output=embed";
const currentOrderUrl =
  "https://qopla.com/restaurant/doni-trattoria-italiana/qyZkGvbq9M/order";
const phoneHref = "tel:+4686568400";
const emailHref = "mailto:donitrattoria@gmail.com";
const instagramUrl = "https://www.instagram.com/donis.trattoria/";

const FEATURED_PRIORITY = [
  "diavola",
  "tagliatelle al ragu",
  "spaghetti con scampi e zucchini",
  "arrabiata con burrata",
];

const copy = {
  sv: {
    about: "Om oss",
    menu: "Meny",
    gallery: "Galleri",
    contact: "Kontakt",
    language: "Språk",
    openMenu: "Öppna meny",
    closeMenu: "Stäng meny",
    eyebrow: "Äkta italiensk mat",
    viewMenu: "Se menyn",
    order: "Beställ online",
    book: "Boka bord",
    featureTaste: "Äkta italienska smaker",
    featureFamily: "Familjär atmosfär",
    featureWater: "Vid vattnet i Hornsberg",
    featureWine: "Utvalda viner",
    featureWelcome: "Välkommen alltid",
    featuredKicker: "Utvalda favoriter",
    featuredTitle: "Från köket",
    aboutKicker: "Om oss",
    aboutCta: "Läs mer om oss",
    menuKicker: "Vår meny",
    menuTitle: "Något för alla smaker",
    menuIntro:
      "Antipasti, färsk pasta, surdegspizza, utvalda huvudrätter och drycker.",
    menuFallbackNote:
      "Utbud och priser kan ändras. Restaurangen uppdaterar aktuell meny.",
    noMenu:
      "Menyn publiceras snart. Kontakta restaurangen för aktuella rätter och priser.",
    galleryKicker: "Galleri",
    galleryTitle: "En smak av Doni’s",
    galleryIntro:
      "Mat, detaljer och stämning från Doni’s vid Hornsbergs Strand.",
    all: "Alla",
    kindFood: "Mat",
    kindInterior: "Restaurangen",
    kindExterior: "Vid vattnet",
    kindAtmosphere: "Stämning",
    kindFamily: "Familj",
    contactKicker: "Kontakt",
    contactTitle: "Välkommen till oss",
    contactBody:
      "Njut av god mat, vackra omgivningar och en avslappnad atmosfär vid Hornsbergs Strand. Boka bord, ring oss eller kom förbi.",
    hours: "Öppettider",
    closed: "Stängt",
    call: "Ring oss",
    directions: "Hitta hit",
    address: "Adress",
    phone: "Telefon",
    email: "E-post",
    instagram: "Instagram",
    follow: "Följ oss",
    mapTitle: "Doni’s Trattoria på Hornsbergs Strand",
    footerLine: "Italienska smaker vid Hornsbergs Strand.",
  },
  en: {
    about: "About",
    menu: "Menu",
    gallery: "Gallery",
    contact: "Contact",
    language: "Language",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    eyebrow: "Authentic Italian food",
    viewMenu: "View menu",
    order: "Order online",
    book: "Book a table",
    featureTaste: "Authentic Italian flavours",
    featureFamily: "Family atmosphere",
    featureWater: "By the water in Hornsberg",
    featureWine: "Selected wines",
    featureWelcome: "Always welcome",
    featuredKicker: "Selected favourites",
    featuredTitle: "From the kitchen",
    aboutKicker: "About",
    aboutCta: "Read more about us",
    menuKicker: "Our menu",
    menuTitle: "Something for every taste",
    menuIntro:
      "Antipasti, fresh pasta, sourdough pizza, selected mains and drinks.",
    menuFallbackNote:
      "Selection and prices may change. The restaurant maintains the current menu.",
    noMenu:
      "The menu will be published soon. Contact the restaurant for current dishes and prices.",
    galleryKicker: "Gallery",
    galleryTitle: "A taste of Doni’s",
    galleryIntro:
      "Food, details and atmosphere from Doni’s by Hornsbergs Strand.",
    all: "All",
    kindFood: "Food",
    kindInterior: "Restaurant",
    kindExterior: "By the water",
    kindAtmosphere: "Atmosphere",
    kindFamily: "Family",
    contactKicker: "Contact",
    contactTitle: "Welcome to Doni’s",
    contactBody:
      "Enjoy good food, beautiful surroundings and a relaxed atmosphere by Hornsbergs Strand. Book a table, call us or simply stop by.",
    hours: "Opening hours",
    closed: "Closed",
    call: "Call us",
    directions: "Directions",
    address: "Address",
    phone: "Phone",
    email: "Email",
    instagram: "Instagram",
    follow: "Follow us",
    mapTitle: "Doni’s Trattoria at Hornsbergs Strand",
    footerLine: "Italian flavours by Hornsbergs Strand.",
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

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

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
        transform: visible ? "translateY(0px)" : "translateY(22px)",
        transition:
          "opacity 650ms ease " +
          delay +
          "ms, transform 650ms ease " +
          delay +
          "ms",
      }}
    >
      {children}
    </div>
  );
}

function normalizeDishName(value: string) {
  return value.trim().toLocaleLowerCase("sv-SE");
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.34em] text-[#d6aa58] sm:text-[11px]">
      {children}
    </p>
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [galleryFilter, setGalleryFilter] = useState<string>("all");

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previous = document.body.style.overflow;
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const unlockOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    desktopQuery.addEventListener("change", unlockOnDesktop);

    return () => {
      document.body.style.overflow = previous;
      desktopQuery.removeEventListener("change", unlockOnDesktop);
    };
  }, [mobileMenuOpen]);

  const t = copy[lang];
  const isFallback = site === null;
  const displaySite = site ?? DONIS_LUXURY_FALLBACK_SITE;
  const displayImages = isFallback ? DONIS_LUXURY_FALLBACK_IMAGES : images;
  const text = displaySite.text;

  const visibleDishes = [...displaySite.dishes]
    .filter((dish) => !dish.hidden && !dish.archived)
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

  const activeCategoryId =
    selectedCategoryId &&
    categories.some((category) => category.id === selectedCategoryId)
      ? selectedCategoryId
      : categories[0]?.id ?? null;

  const activeCategory = categories.find(
    (category) => category.id === activeCategoryId,
  );
  const activeDishes = activeCategoryId
    ? dishesByCategory(activeCategoryId)
    : [];

  const hero =
    displaySite.media.hero && displayImages[displaySite.media.hero.id]
      ? displayImages[displaySite.media.hero.id]
      : heroFallback;

  const booking = displaySite.links.booking;
  const bookingHref = booking || phoneHref;
  const order = displaySite.links.order || currentOrderUrl;

  const featured = [...visibleDishes]
    .filter((dish) => dish.image && Boolean(displayImages[dish.image.id]))
    .sort((a, b) => {
      const aIndex = FEATURED_PRIORITY.indexOf(normalizeDishName(a.name));
      const bIndex = FEATURED_PRIORITY.indexOf(normalizeDishName(b.name));
      const aRank = aIndex === -1 ? FEATURED_PRIORITY.length + a.sortOrder : aIndex;
      const bRank = bIndex === -1 ? FEATURED_PRIORITY.length + b.sortOrder : bIndex;
      return aRank - bRank;
    })
    .slice(0, 4);

  const rawGallery = [...displaySite.media.gallery]
    .filter((item) => Boolean(displayImages[item.id]))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      id: item.id,
      url: displayImages[item.id],
      alt: item.alt[lang],
      kind: item.kind as GalleryKind,
    }));

  const dishGallery = visibleDishes
    .filter(
      (dish) =>
        dish.image &&
        Boolean(displayImages[dish.image.id]) &&
        !rawGallery.some((item) => item.id === dish.image?.id),
    )
    .map((dish) => ({
      id: dish.image!.id,
      url: displayImages[dish.image!.id],
      alt: dish.image!.alt[lang],
      kind: "food" as GalleryKind,
    }));

  const galleryVisuals = [...rawGallery, ...dishGallery].slice(0, 9);

  const galleryKinds = Array.from(
    new Set(galleryVisuals.map((item) => item.kind)),
  );

  const filteredGallery =
    galleryFilter === "all"
      ? galleryVisuals
      : galleryVisuals.filter((item) => item.kind === galleryFilter);

  const aboutImage =
    displaySite.media.family && displayImages[displaySite.media.family.id]
      ? {
          url: displayImages[displaySite.media.family.id],
          alt: displaySite.media.family.alt[lang],
        }
      : displaySite.media.owner && displayImages[displaySite.media.owner.id]
        ? {
            url: displayImages[displaySite.media.owner.id],
            alt: displaySite.media.owner.alt[lang],
          }
        : rawGallery.find(
              (item) =>
                item.kind === "interior" ||
                item.kind === "exterior" ||
                item.kind === "atmosphere",
            ) ?? rawGallery[0] ?? { url: hero, alt: "Doni’s Trattoria" };

  const galleryKindLabel = (kind: string) => {
    if (kind === "food") return t.kindFood;
    if (kind === "interior") return t.kindInterior;
    if (kind === "exterior") return t.kindExterior;
    if (kind === "atmosphere") return t.kindAtmosphere;
    if (kind === "family") return t.kindFamily;
    return kind;
  };

  const formatPrice = (dish: Dish) => {
    if (dish.priceOre === null) return null;
    return (
      (dish.priceOre / 100).toLocaleString(
        lang === "sv" ? "sv-SE" : "en-SE",
        { maximumFractionDigits: 2 },
      ) + " kr"
    );
  };

  const values = [
    { icon: UtensilsCrossed, label: t.featureTaste },
    { icon: Heart, label: t.featureFamily },
    { icon: Waves, label: t.featureWater },
    { icon: Wine, label: t.featureWine },
    { icon: UsersRound, label: t.featureWelcome },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div
      lang={lang}
      className="min-h-screen overflow-x-hidden bg-[#080a08] text-[#f4ead8] selection:bg-[#d6aa58] selection:text-[#0c0d0b]"
    >
      <section id="top" className="relative min-h-[760px] overflow-hidden bg-[#080a08]">
        <img
          src={hero}
          alt={displaySite.media.hero?.alt[lang] || "Doni’s Trattoria"}
          className="absolute inset-0 h-full w-full scale-[1.015] object-cover object-center"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,5,.98)_0%,rgba(5,7,5,.90)_27%,rgba(5,7,5,.48)_58%,rgba(5,7,5,.18)_78%,rgba(5,7,5,.42)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,5,4,.55)_0%,transparent_28%,rgba(4,5,4,.78)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_48%,rgba(222,160,71,.20),transparent_34%)]" />

        <header className="relative z-30 border-b border-white/10 bg-black/20 backdrop-blur-md">
          <div className="mx-auto flex min-h-[76px] max-w-[1460px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
            <a
              href="#top"
              aria-label="Doni’s Trattoria"
              className="group flex shrink-0 items-center gap-3"
            >
              <span
                aria-hidden="true"
                className="h-12 w-14 rounded-[14px] border border-[#d6aa58]/40 bg-[#ead7ae] bg-center bg-no-repeat transition group-hover:border-[#d6aa58]"
                style={{
                  backgroundImage: "url('/donis-logo.png')",
                  backgroundSize: "82% auto",
                }}
              />
              <span>
                <span className="block font-serif text-[25px] font-semibold leading-[0.9] tracking-[-0.04em] text-[#f6ead4]">
                  Doni’s
                </span>
                <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.34em] text-[#d6aa58]">
                  Trattoria
                </span>
              </span>
            </a>

            <nav
              aria-label={lang === "sv" ? "Huvudmeny" : "Main menu"}
              className="hidden items-center gap-8 text-[12px] font-semibold text-white/80 lg:flex"
            >
              <a className="transition hover:text-[#e1b967]" href="#om">
                {t.about}
              </a>
              <a className="transition hover:text-[#e1b967]" href="#meny">
                {t.menu}
              </a>
              {galleryVisuals.length > 0 && (
                <a className="transition hover:text-[#e1b967]" href="#galleri">
                  {t.gallery}
                </a>
              )}
              <a className="transition hover:text-[#e1b967]" href="#kontakt">
                {t.contact}
              </a>
            </nav>

            <div className="hidden items-center gap-2 lg:flex">
              <div
                className="flex items-center gap-1 border-r border-white/15 pr-3"
                aria-label={t.language}
              >
                {(["sv", "en"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLang(option)}
                    aria-pressed={lang === option}
                    className={
                      "min-h-9 px-2 text-[11px] font-black uppercase transition " +
                      (lang === option
                        ? "text-[#e7bd67]"
                        : "text-white/50 hover:text-white")
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
              <a
                href={bookingHref}
                target={booking ? "_blank" : undefined}
                rel={booking ? "noopener noreferrer" : undefined}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d6aa58]/70 px-5 text-[12px] font-bold text-[#f4ead8] transition hover:bg-[#d6aa58] hover:text-[#11120f]"
              >
                <CalendarDays className="h-4 w-4" />
                {t.book}
              </a>
              <a
                href={order}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#deb45f] px-5 text-[12px] font-black text-[#15140f] shadow-[0_10px_30px_rgba(214,170,88,.18)] transition hover:-translate-y-0.5 hover:bg-[#ebc66f]"
              >
                <ShoppingBag className="h-4 w-4" />
                {t.order}
              </a>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={t.openMenu}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-[#080a08]/98 px-5 py-5 backdrop-blur-xl lg:hidden">
            <div className="mx-auto flex max-w-md items-center justify-between">
              <a
                href="#top"
                onClick={closeMobileMenu}
                className="font-serif text-3xl text-[#f4ead8]"
              >
                Doni’s
              </a>
              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label={t.closeMenu}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mx-auto mt-16 grid max-w-md gap-2 font-serif text-4xl">
              <a onClick={closeMobileMenu} className="border-b border-white/10 py-4" href="#om">
                {t.about}
              </a>
              <a onClick={closeMobileMenu} className="border-b border-white/10 py-4" href="#meny">
                {t.menu}
              </a>
              {galleryVisuals.length > 0 && (
                <a
                  onClick={closeMobileMenu}
                  className="border-b border-white/10 py-4"
                  href="#galleri"
                >
                  {t.gallery}
                </a>
              )}
              <a onClick={closeMobileMenu} className="border-b border-white/10 py-4" href="#kontakt">
                {t.contact}
              </a>
            </nav>
            <div className="mx-auto mt-8 flex max-w-md items-center gap-2">
              {(["sv", "en"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLang(option)}
                  aria-pressed={lang === option}
                  className={
                    "rounded-full border px-5 py-2 text-xs font-black uppercase " +
                    (lang === option
                      ? "border-[#d6aa58] bg-[#d6aa58] text-black"
                      : "border-white/15 text-white/60")
                  }
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="mx-auto mt-8 grid max-w-md gap-3">
              <a
                href={bookingHref}
                target={booking ? "_blank" : undefined}
                rel={booking ? "noopener noreferrer" : undefined}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-[#d6aa58]/70 px-6 font-bold"
              >
                <CalendarDays className="h-4 w-4" />
                {t.book}
              </a>
              <a
                href={order}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#deb45f] px-6 font-black text-[#15140f]"
              >
                <ShoppingBag className="h-4 w-4" />
                {t.order}
              </a>
            </div>
          </div>
        )}

        <div className="relative z-10 mx-auto flex min-h-[600px] max-w-[1460px] items-center px-4 pb-14 pt-16 sm:px-8 md:pb-32 lg:min-h-[660px] lg:px-12">
          <div className="max-w-[760px]">
            <Reveal>
              <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
              <h1 className="mt-5 max-w-[760px] font-serif text-[clamp(4.3rem,9vw,8.1rem)] leading-[0.78] tracking-[-0.062em] text-[#f6ead4]">
                {text.heroTitle[lang] || "Doni’s Trattoria"}
              </h1>
              {text.heroDescription[lang] && (
                <p className="mt-8 max-w-[620px] text-base leading-7 text-white/78 sm:text-lg sm:leading-8">
                  {text.heroDescription[lang]}
                </p>
              )}
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#meny"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#deb45f] px-6 text-sm font-black text-[#15140f] shadow-[0_10px_30px_rgba(214,170,88,.18)] transition hover:-translate-y-0.5 hover:bg-[#ebc66f]"
                >
                  {t.viewMenu}
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={order}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#d6aa58]/65 bg-black/20 px-6 text-sm font-bold text-[#f7ecd7] backdrop-blur transition hover:border-[#e7bd67] hover:text-[#e7bd67]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {t.order}
                </a>
                <a
                  href={bookingHref}
                  target={booking ? "_blank" : undefined}
                  rel={booking ? "noopener noreferrer" : undefined}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 bg-black/20 px-6 text-sm font-bold text-white/90 backdrop-blur transition hover:border-[#d6aa58]/70 hover:text-[#e7bd67]"
                >
                  <CalendarDays className="h-4 w-4" />
                  {t.book}
                </a>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="relative z-20 border-y border-white/10 bg-[#080a08]/88 backdrop-blur-xl md:absolute md:bottom-0 md:left-0 md:right-0">
          <div className="mx-auto grid max-w-[1460px] grid-cols-2 px-4 sm:px-8 md:grid-cols-5 lg:px-12">
            {values.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={
                    "flex min-h-[76px] items-center gap-3 border-white/10 py-4 " +
                    (index > 0 ? "md:border-l md:pl-5" : "")
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 text-[#d6aa58]" strokeWidth={1.7} />
                  <span className="text-[11px] font-semibold text-white/78 sm:text-xs">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="relative border-b border-white/10 bg-[#0a0c0a] px-4 py-12 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-[1460px]">
            <Reveal>
              <div className="mb-7 flex items-end justify-between gap-4">
                <div>
                  <SectionEyebrow>{t.featuredKicker}</SectionEyebrow>
                  <h2 className="mt-2 font-serif text-3xl tracking-[-0.035em] text-[#f4ead8] sm:text-4xl">
                    {t.featuredTitle}
                  </h2>
                </div>
                <a
                  href="#meny"
                  className="hidden items-center gap-2 text-xs font-bold text-[#d6aa58] transition hover:text-[#efcd87] sm:inline-flex"
                >
                  {t.viewMenu}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featured.map((dish, index) => {
                const price = formatPrice(dish);
                const category = categories.find(
                  (item) => item.id === dish.categoryId,
                );
                return (
                  <Reveal key={dish.id} delay={index * 70}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(dish.categoryId);
                        document
                          .getElementById("meny")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="group w-full overflow-hidden rounded-[18px] border border-white/12 bg-[#111410] text-left shadow-[0_18px_55px_rgba(0,0,0,.22)] transition duration-300 hover:-translate-y-1 hover:border-[#d6aa58]/45"
                    >
                      <div className="relative aspect-[1.55/1] overflow-hidden bg-[#171a15]">
                        <img
                          src={displayImages[dish.image!.id]}
                          alt={dish.image!.alt[lang]}
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="font-serif text-[22px] leading-tight text-[#f6ead4]">
                            {dish.name}
                          </h3>
                          {price && (
                            <span className="shrink-0 text-sm font-black text-[#deb45f]">
                              {price}
                            </span>
                          )}
                        </div>
                        {dish.description[lang] ? (
                          <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-white/55">
                            {dish.description[lang]}
                          </p>
                        ) : category ? (
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                            {category.name[lang] || category.name.sv}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section
        id="om"
        className="scroll-mt-20 border-b border-white/10 bg-[#090b09] px-4 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      >
        <div className="mx-auto grid max-w-[1460px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0e110e] lg:grid-cols-[1.02fr_.98fr]">
          <Reveal className="min-h-[420px] lg:min-h-[560px]">
            <div className="relative h-full min-h-[420px] overflow-hidden lg:min-h-[560px]">
              <img
                src={aboutImage.url}
                alt={aboutImage.alt}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(5,6,5,.72)_100%)]" />
              <div className="absolute bottom-5 left-5 rounded-full border border-[#d6aa58]/45 bg-black/45 px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#e9c779] backdrop-blur">
                Hornsbergs Strand · Stockholm
              </div>
            </div>
          </Reveal>

          <Reveal delay={90} className="flex">
            <div className="relative flex w-full flex-col justify-center overflow-hidden px-6 py-14 sm:px-10 lg:px-14 lg:py-16">
              <div className="absolute -right-28 top-8 h-64 w-64 rounded-full border border-[#d6aa58]/10" />
              <div className="absolute -right-16 top-24 h-40 w-40 rounded-full border border-[#d6aa58]/10" />
              <SectionEyebrow>{t.aboutKicker}</SectionEyebrow>
              <h2 className="mt-4 max-w-[560px] font-serif text-5xl leading-[0.94] tracking-[-0.045em] text-[#f4ead8] sm:text-6xl">
                {text.aboutTitle[lang] || "Doni’s Trattoria"}
              </h2>
              <div className="mt-7 max-w-[620px] space-y-4 text-[15px] leading-7 text-white/64">
                {text.story[lang] && <p>{text.story[lang]}</p>}
                {text.ownerIntroduction[lang] && (
                  <p>{text.ownerIntroduction[lang]}</p>
                )}
                {text.philosophy[lang] && <p>{text.philosophy[lang]}</p>}
              </div>
              <a
                href="#kontakt"
                className="mt-8 inline-flex w-fit min-h-12 items-center gap-2 rounded-full bg-[#deb45f] px-6 text-sm font-black text-[#15140f] transition hover:-translate-y-0.5 hover:bg-[#ebc66f]"
              >
                {t.aboutCta}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <section
        id="meny"
        className="scroll-mt-20 border-b border-white/10 bg-[#080a08] px-4 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      >
        <div className="mx-auto max-w-[1460px]">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>{t.menuKicker}</SectionEyebrow>
              <h2 className="mt-4 font-serif text-5xl leading-[0.94] tracking-[-0.045em] text-[#f4ead8] sm:text-6xl lg:text-7xl">
                {t.menuTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
                {t.menuIntro}
              </p>
              {isFallback && (
                <p className="mx-auto mt-3 max-w-2xl text-xs leading-5 text-white/35">
                  {t.menuFallbackNote}
                </p>
              )}
            </div>
          </Reveal>

          {categories.length > 0 ? (
            <>
              <div className="mx-auto mt-9 flex max-w-full justify-start gap-2 overflow-x-auto pb-2 sm:justify-center">
                {categories.map((category) => {
                  const active = category.id === activeCategoryId;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(category.id)}
                      aria-pressed={active}
                      className={
                        "min-h-10 shrink-0 rounded-full border px-5 text-xs font-bold transition " +
                        (active
                          ? "border-[#deb45f] bg-[#deb45f] text-[#15140f]"
                          : "border-white/18 bg-white/[0.02] text-white/68 hover:border-[#d6aa58]/55 hover:text-[#e7bd67]")
                      }
                    >
                      {category.name[lang] || category.name.sv}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {activeDishes.map((dish, index) => {
                  const dishImage =
                    dish.image && displayImages[dish.image.id]
                      ? displayImages[dish.image.id]
                      : null;
                  const price = formatPrice(dish);
                  return (
                    <Reveal key={dish.id} delay={index * 55}>
                      <article className="group h-full overflow-hidden rounded-[20px] border border-white/12 bg-[#10130f] shadow-[0_18px_55px_rgba(0,0,0,.20)] transition duration-300 hover:-translate-y-1 hover:border-[#d6aa58]/45">
                        {dishImage ? (
                          <div className="aspect-[1.18/1] overflow-hidden bg-[#171a15]">
                            <img
                              src={dishImage}
                              alt={dish.image!.alt[lang]}
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"
                            />
                          </div>
                        ) : (
                          <div className="flex aspect-[1.18/1] items-center justify-center bg-[radial-gradient(circle_at_center,rgba(214,170,88,.12),transparent_58%)]">
                            <UtensilsCrossed className="h-8 w-8 text-[#d6aa58]/45" strokeWidth={1.3} />
                          </div>
                        )}
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="font-serif text-2xl leading-tight text-[#f6ead4]">
                              {dish.name}
                            </h3>
                            {price && (
                              <span className="shrink-0 text-sm font-black text-[#deb45f]">
                                {price}
                              </span>
                            )}
                          </div>
                          {dish.description[lang] && (
                            <p className="mt-3 text-sm leading-6 text-white/52">
                              {dish.description[lang]}
                            </p>
                          )}
                        </div>
                      </article>
                    </Reveal>
                  );
                })}
              </div>

              {activeCategory && (
                <div className="mt-8 flex justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/38">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#d6aa58]" />
                    {activeCategory.name[lang] || activeCategory.name.sv}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-12 text-center text-white/55">{t.noMenu}</p>
          )}
        </div>
      </section>

      {galleryVisuals.length > 0 && (
        <section
          id="galleri"
          className="scroll-mt-20 border-b border-white/10 bg-[#0a0c0a] px-4 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28"
        >
          <div className="mx-auto max-w-[1460px]">
            <Reveal>
              <div className="mx-auto max-w-3xl text-center">
                <SectionEyebrow>{t.galleryKicker}</SectionEyebrow>
                <h2 className="mt-4 font-serif text-5xl leading-[0.94] tracking-[-0.045em] text-[#f4ead8] sm:text-6xl">
                  {t.galleryTitle}
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/50">
                  {t.galleryIntro}
                </p>
              </div>
            </Reveal>

            {galleryKinds.length > 1 && (
              <div className="mt-8 flex justify-start gap-2 overflow-x-auto pb-2 sm:justify-center">
                <button
                  type="button"
                  onClick={() => setGalleryFilter("all")}
                  aria-pressed={galleryFilter === "all"}
                  className={
                    "min-h-10 shrink-0 rounded-full border px-5 text-xs font-bold transition " +
                    (galleryFilter === "all"
                      ? "border-[#deb45f] bg-[#deb45f] text-[#15140f]"
                      : "border-white/18 text-white/65 hover:border-[#d6aa58]/55 hover:text-[#e7bd67]")
                  }
                >
                  {t.all}
                </button>
                {galleryKinds.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setGalleryFilter(kind)}
                    aria-pressed={galleryFilter === kind}
                    className={
                      "min-h-10 shrink-0 rounded-full border px-5 text-xs font-bold transition " +
                      (galleryFilter === kind
                        ? "border-[#deb45f] bg-[#deb45f] text-[#15140f]"
                        : "border-white/18 text-white/65 hover:border-[#d6aa58]/55 hover:text-[#e7bd67]")
                    }
                  >
                    {galleryKindLabel(kind)}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-9 grid auto-rows-[190px] grid-cols-2 gap-3 sm:auto-rows-[230px] lg:grid-cols-12">
              {filteredGallery.map((item, index) => {
                const spanClass =
                  index === 0
                    ? "col-span-2 row-span-2 lg:col-span-5"
                    : index === 1
                      ? "col-span-1 lg:col-span-4"
                      : index === 2
                        ? "col-span-1 lg:col-span-3"
                        : index === 3
                          ? "col-span-1 lg:col-span-3"
                          : index === 4
                            ? "col-span-1 lg:col-span-4"
                            : "col-span-1 lg:col-span-3";
                return (
                  <Reveal
                    key={item.id}
                    className={
                      "group relative overflow-hidden rounded-[18px] border border-white/8 bg-[#111410] " +
                      spanClass
                    }
                    delay={index * 45}
                  >
                    <img
                      src={item.url}
                      alt={item.alt}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-70" />
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section
        id="kontakt"
        className="scroll-mt-20 bg-[#080a08] px-4 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28"
      >
        <div className="mx-auto max-w-[1460px]">
          <Reveal>
            <div className="mb-10 max-w-3xl">
              <SectionEyebrow>{t.contactKicker}</SectionEyebrow>
              <h2 className="mt-4 font-serif text-5xl leading-[0.94] tracking-[-0.045em] text-[#f4ead8] sm:text-6xl">
                {t.contactTitle}
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/56 sm:text-base">
                {t.contactBody}
              </p>
            </div>
          </Reveal>

          <div className="grid gap-4 lg:grid-cols-12">
            <Reveal className="lg:col-span-4">
              <div className="h-full rounded-[24px] border border-white/10 bg-[#10130f] p-6 sm:p-7">
                <div className="grid gap-5">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-4"
                  >
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d6aa58]/30 bg-[#d6aa58]/8 text-[#e7bd67]">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                        {t.address}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-white/78 transition group-hover:text-[#e7bd67]">
                        Hornsbergs Strand 77
                        <br />
                        112 16 Stockholm
                      </span>
                    </span>
                  </a>
                  <a href={phoneHref} className="group flex items-center gap-4">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d6aa58]/30 bg-[#d6aa58]/8 text-[#e7bd67]">
                      <Phone className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                        {t.phone}
                      </span>
                      <span className="mt-1 block text-sm text-white/78 transition group-hover:text-[#e7bd67]">
                        08-656 84 00
                      </span>
                    </span>
                  </a>
                  <a href={emailHref} className="group flex items-center gap-4">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d6aa58]/30 bg-[#d6aa58]/8 text-[#e7bd67]">
                      <Mail className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                        {t.email}
                      </span>
                      <span className="mt-1 block truncate text-sm text-white/78 transition group-hover:text-[#e7bd67]">
                        donitrattoria@gmail.com
                      </span>
                    </span>
                  </a>
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d6aa58]/30 bg-[#d6aa58]/8 text-[#e7bd67]">
                      <Camera className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                        {t.instagram}
                      </span>
                      <span className="mt-1 block text-sm text-white/78 transition group-hover:text-[#e7bd67]">
                        @donis.trattoria
                      </span>
                    </span>
                  </a>
                </div>

                <div className="mt-7 flex flex-wrap gap-2">
                  <a
                    href={bookingHref}
                    target={booking ? "_blank" : undefined}
                    rel={booking ? "noopener noreferrer" : undefined}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#deb45f] px-5 text-xs font-black text-[#15140f] transition hover:bg-[#ebc66f]"
                  >
                    <CalendarDays className="h-4 w-4" />
                    {t.book}
                  </a>
                  <a
                    href={phoneHref}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-xs font-bold text-white/78 transition hover:border-[#d6aa58]/50 hover:text-[#e7bd67]"
                  >
                    <Phone className="h-4 w-4" />
                    {t.call}
                  </a>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-xs font-bold text-white/78 transition hover:border-[#d6aa58]/50 hover:text-[#e7bd67]"
                  >
                    <Navigation className="h-4 w-4" />
                    {t.directions}
                  </a>
                </div>
              </div>
            </Reveal>

            <Reveal delay={70} className="lg:col-span-3">
              <div className="h-full rounded-[24px] border border-white/10 bg-[#10130f] p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-[#d6aa58]" />
                  <h3 className="font-serif text-2xl text-[#f4ead8]">
                    {t.hours}
                  </h3>
                </div>
                <div className="mt-5 divide-y divide-white/8">
                  {displaySite.hours.map((hour) => (
                    <div
                      key={hour.day}
                      className="flex items-center justify-between gap-4 py-3 text-[13px]"
                    >
                      <span className="text-white/50">{days[lang][hour.day]}</span>
                      <span className="font-bold tabular-nums text-white/85">
                        {hour.closed ? t.closed : hour.open + "–" + hour.close}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={120} className="lg:col-span-5">
              <div className="relative h-[360px] overflow-hidden rounded-[24px] border border-white/10 bg-[#10130f] lg:h-full lg:min-h-[430px]">
                <iframe
                  title={t.mapTitle}
                  src={mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="pointer-events-none absolute inset-0 h-full w-full border-0 opacity-80 grayscale-[20%] contrast-[1.03]"
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,8,.06),rgba(8,10,8,.48))]" />
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group absolute bottom-5 left-5 right-5 flex items-center justify-between gap-4 rounded-[16px] border border-white/12 bg-[#090b09]/88 p-4 backdrop-blur-xl"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#deb45f] text-[#15140f]">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-serif text-lg text-[#f4ead8]">
                        Doni’s Trattoria
                      </span>
                      <span className="block truncate text-[11px] text-white/50">
                        Hornsbergs Strand 77
                      </span>
                    </span>
                  </div>
                  <Navigation className="h-5 w-5 shrink-0 text-[#d6aa58] transition group-hover:translate-x-0.5" />
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#060706] px-4 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1460px]">
          <div className="flex flex-col gap-8 border-b border-white/8 pb-8 lg:flex-row lg:items-center lg:justify-between">
            <a href="#top" className="flex w-fit items-center gap-3">
              <span
                aria-hidden="true"
                className="h-12 w-14 rounded-[14px] border border-[#d6aa58]/30 bg-[#ead7ae] bg-center bg-no-repeat"
                style={{
                  backgroundImage: "url('/donis-logo.png')",
                  backgroundSize: "82% auto",
                }}
              />
              <span>
                <span className="block font-serif text-2xl leading-none text-[#f4ead8]">
                  Doni’s
                </span>
                <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.32em] text-[#d6aa58]">
                  Trattoria
                </span>
              </span>
            </a>

            <nav className="flex flex-wrap gap-x-7 gap-y-3 text-xs font-semibold text-white/55">
              <a className="transition hover:text-[#e7bd67]" href="#om">
                {t.about}
              </a>
              <a className="transition hover:text-[#e7bd67]" href="#meny">
                {t.menu}
              </a>
              {galleryVisuals.length > 0 && (
                <a className="transition hover:text-[#e7bd67]" href="#galleri">
                  {t.gallery}
                </a>
              )}
              <a className="transition hover:text-[#e7bd67]" href="#kontakt">
                {t.contact}
              </a>
            </nav>

            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.follow + " Instagram"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 text-white/65 transition hover:border-[#d6aa58]/50 hover:text-[#e7bd67]"
            >
              <Camera className="h-4 w-4" />
            </a>
          </div>

          <div className="flex flex-col gap-3 pt-6 text-[11px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 Doni’s Trattoria. {t.footerLine}</span>
            <span>Org.nr 556852-1420</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
