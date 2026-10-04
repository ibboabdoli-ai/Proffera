import type { RestaurantSite } from "./restaurant-site-schema";

const ids = {
  categories: {
    pizza: "11111111-1111-4111-8111-111111111111",
    pasta: "22222222-2222-4222-8222-222222222222",
    europe: "33333333-3333-4333-8333-333333333333",
  },
  images: {
    hero: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    pizza: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    pasta: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    antipasto: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
    dessert: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
    vegetariana: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    diavola: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    fettuccini: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3",
    vodka: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4",
    mare: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5",
    schnitzel: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6",
  },
  dishes: {
    vegetariana: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    diavola: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
    fettuccini: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
    vodka: "cccccccc-cccc-4ccc-8ccc-ccccccccccc4",
    mare: "cccccccc-cccc-4ccc-8ccc-ccccccccccc5",
    schnitzel: "cccccccc-cccc-4ccc-8ccc-ccccccccccc6",
  },
} as const;

export const DONIS_FALLBACK_IMAGES: Record<string, string> = {
  [ids.images.hero]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/05/donis-pizzorny.jpg",
  [ids.images.pizza]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/05/donis-pizzorny.jpg",
  [ids.images.pasta]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/05/donis-pastaratter.jpg",
  [ids.images.antipasto]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/05/donis-antipasto.jpg",
  [ids.images.dessert]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/05/donis-efterratt.jpg",
  [ids.images.vegetariana]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/06/donis-vegetariana.jpg",
  [ids.images.diavola]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/06/donis-diavola.jpg",
  [ids.images.fettuccini]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/06/donis-fettuccini-donis.jpg",
  [ids.images.vodka]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/06/donis-penne-alla-vodka.jpg",
  [ids.images.mare]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/06/donis-mare-mare.jpg",
  [ids.images.schnitzel]:
    "https://www-static.restaurangkungsholmen.se/wp-content/uploads/2025/06/donis-klassisk-schnitzel.jpg",
};

const image = (id: string, sv: string, en: string) => ({
  id,
  alt: { sv, en },
});

export const DONIS_FALLBACK_SITE: RestaurantSite = {
  categories: [
    {
      id: ids.categories.pizza,
      name: { sv: "Pizza", en: "Pizza" },
      sortOrder: 0,
      hidden: false,
    },
    {
      id: ids.categories.pasta,
      name: { sv: "Pasta", en: "Pasta" },
      sortOrder: 1,
      hidden: false,
    },
    {
      id: ids.categories.europe,
      name: { sv: "En smak av Europa", en: "A taste of Europe" },
      sortOrder: 2,
      hidden: false,
    },
  ],
  dishes: [
    {
      id: ids.dishes.vegetariana,
      categoryId: ids.categories.pizza,
      name: "Vegetariana",
      priceOre: null,
      description: { sv: "", en: "" },
      image: image(
        ids.images.vegetariana,
        "Vegetariana pizza på Doni’s Trattoria",
        "Vegetariana pizza at Doni’s Trattoria",
      ),
      sortOrder: 0,
      hidden: false,
      archived: false,
    },
    {
      id: ids.dishes.diavola,
      categoryId: ids.categories.pizza,
      name: "Diavola",
      priceOre: null,
      description: { sv: "", en: "" },
      image: image(
        ids.images.diavola,
        "Diavola pizza på Doni’s Trattoria",
        "Diavola pizza at Doni’s Trattoria",
      ),
      sortOrder: 1,
      hidden: false,
      archived: false,
    },
    {
      id: ids.dishes.fettuccini,
      categoryId: ids.categories.pasta,
      name: "Fettuccini Donis",
      priceOre: null,
      description: { sv: "", en: "" },
      image: image(
        ids.images.fettuccini,
        "Fettuccini Donis",
        "Fettuccini Donis",
      ),
      sortOrder: 0,
      hidden: false,
      archived: false,
    },
    {
      id: ids.dishes.vodka,
      categoryId: ids.categories.pasta,
      name: "Penne alla vodka",
      priceOre: null,
      description: { sv: "", en: "" },
      image: image(
        ids.images.vodka,
        "Penne alla vodka",
        "Penne alla vodka",
      ),
      sortOrder: 1,
      hidden: false,
      archived: false,
    },
    {
      id: ids.dishes.mare,
      categoryId: ids.categories.pasta,
      name: "Mare mare",
      priceOre: null,
      description: { sv: "", en: "" },
      image: image(ids.images.mare, "Mare mare", "Mare mare"),
      sortOrder: 2,
      hidden: false,
      archived: false,
    },
    {
      id: ids.dishes.schnitzel,
      categoryId: ids.categories.europe,
      name: "Klassisk schnitzel",
      priceOre: null,
      description: { sv: "", en: "" },
      image: image(
        ids.images.schnitzel,
        "Klassisk schnitzel",
        "Classic schnitzel",
      ),
      sortOrder: 0,
      hidden: false,
      archived: false,
    },
  ],
  media: {
    hero: image(
      ids.images.hero,
      "Pizza och italienska smaker på Doni’s Trattoria",
      "Pizza and Italian flavours at Doni’s Trattoria",
    ),
    gallery: [
      {
        ...image(ids.images.pasta, "Pastarätter", "Pasta dishes"),
        kind: "food",
        sortOrder: 0,
      },
      {
        ...image(ids.images.antipasto, "Antipasto", "Antipasto"),
        kind: "food",
        sortOrder: 1,
      },
      {
        ...image(ids.images.dessert, "Dessert", "Dessert"),
        kind: "food",
        sortOrder: 2,
      },
    ],
    owner: null,
    family: null,
  },
  text: {
    heroTitle: { sv: "Doni’s Trattoria", en: "Doni’s Trattoria" },
    heroDescription: {
      sv: "Italiensk matlagning vid Hornsbergs Strand – pizza, pasta och utvalda favoriter i en varm och avslappnad miljö.",
      en: "Italian cooking by Hornsbergs Strand – pizza, pasta and selected favourites in a warm, relaxed setting.",
    },
    aboutTitle: {
      sv: "Italiensk passion vid vattnet",
      en: "Italian passion by the water",
    },
    story: {
      sv: "Doni’s Trattoria är en familjär restaurang vid Hornsbergs Strand med fokus på italienska smaker, bra råvaror och ett välkomnande besök.",
      en: "Doni’s Trattoria is a welcoming restaurant by Hornsbergs Strand focused on Italian flavours, quality ingredients and relaxed hospitality.",
    },
    ownerIntroduction: {
      sv: "Här möts klassiska italienska rätter med ett mindre urval av europeiska favoriter för sällskap med olika smaker.",
      en: "Classic Italian dishes meet a smaller selection of European favourites for groups with different tastes.",
    },
    philosophy: {
      sv: "Enkel mat, tydliga smaker och en miljö som passar både vardag, familjemiddag och en kväll med vänner.",
      en: "Straightforward food, clear flavours and a setting for everyday meals, family dinners and evenings with friends.",
    },
    menuTitle: { sv: "Något för alla smaker", en: "Something for every taste" },
    menuIntro: {
      sv: "Antipasti, färsk pasta, surdegspizza, utvalda huvudrätter och drycker.",
      en: "Antipasti, fresh pasta, sourdough pizza, selected mains and drinks.",
    },
    galleryTitle: { sv: "En smak av Doni’s", en: "A taste of Doni’s" },
    galleryIntro: {
      sv: "Mat, detaljer och stämning från Doni’s vid Hornsbergs Strand.",
      en: "Food, details and atmosphere from Doni’s by Hornsbergs Strand.",
    },
    contactTitle: { sv: "Välkommen till oss", en: "Welcome to Doni’s" },
    contactBody: {
      sv: "Njut av god mat, vackra omgivningar och en avslappnad atmosfär vid Hornsbergs Strand. Boka bord, ring oss eller kom förbi.",
      en: "Enjoy good food, beautiful surroundings and a relaxed atmosphere by Hornsbergs Strand. Book a table, call us or simply stop by.",
    },
    foundedYear: null,
  },
  business: {
    name: "Doni’s Trattoria",
    address: "Hornsbergs Strand 77",
    postalCode: "112 16",
    city: "Stockholm",
    phone: "08-656 84 00",
    email: "donitrattoria@gmail.com",
    instagram: "@donis.trattoria",
    instagramUrl: "https://www.instagram.com/donis.trattoria/",
    orgNumber: "556852-1420",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Doni%27s+Trattoria+Hornsbergs+Strand+77+Stockholm",
  },
  hours: [
    { day: 0, closed: false, open: "10:30", close: "21:00" },
    { day: 1, closed: false, open: "10:30", close: "21:00" },
    { day: 2, closed: false, open: "10:30", close: "21:00" },
    { day: 3, closed: false, open: "10:30", close: "21:00" },
    { day: 4, closed: false, open: "10:30", close: "22:00" },
    { day: 5, closed: false, open: "12:00", close: "22:00" },
    { day: 6, closed: false, open: "12:00", close: "21:00" },
  ],
  links: {
    booking: "",
    order:
      "https://qopla.com/restaurant/doni-trattoria-italiana/qyZkGvbq9M/order",
  },
};


export const DONIS_FALLBACK_DISH_IMAGE_URLS: Record<string, string> =
  Object.fromEntries(
    DONIS_FALLBACK_SITE.dishes.flatMap((dish) =>
      dish.image && DONIS_FALLBACK_IMAGES[dish.image.id]
        ? [[dish.id, DONIS_FALLBACK_IMAGES[dish.image.id]]]
        : [],
    ),
  );

export function createDonisAdminStarterSite(): RestaurantSite {
  const site = structuredClone(DONIS_FALLBACK_SITE);
  site.media = { hero: null, gallery: [], owner: null, family: null };
  site.dishes = site.dishes.map((dish) => ({ ...dish, image: null }));
  return site;
}

export function isRestaurantSiteBlank(site: RestaurantSite) {
  const text = site.text;
  return (
    site.categories.length === 0 &&
    site.dishes.length === 0 &&
    !site.media.hero &&
    !site.media.owner &&
    !site.media.family &&
    site.media.gallery.length === 0 &&
    !text.heroTitle.sv &&
    !text.heroTitle.en &&
    !text.heroDescription.sv &&
    !text.heroDescription.en &&
    !text.aboutTitle.sv &&
    !text.aboutTitle.en &&
    !text.story.sv &&
    !text.story.en &&
    !text.ownerIntroduction.sv &&
    !text.ownerIntroduction.en &&
    !text.philosophy.sv &&
    !text.philosophy.en &&
    text.menuTitle.sv === "Något för alla smaker" &&
    text.menuTitle.en === "Something for every taste" &&
    text.menuIntro.sv === "Antipasti, färsk pasta, surdegspizza, utvalda huvudrätter och drycker." &&
    text.menuIntro.en === "Antipasti, fresh pasta, sourdough pizza, selected mains and drinks." &&
    text.galleryTitle.sv === "En smak av Doni’s" &&
    text.galleryTitle.en === "A taste of Doni’s" &&
    text.galleryIntro.sv === "Mat, detaljer och stämning från Doni’s vid Hornsbergs Strand." &&
    text.galleryIntro.en === "Food, details and atmosphere from Doni’s by Hornsbergs Strand." &&
    text.contactTitle.sv === "Välkommen till oss" &&
    text.contactTitle.en === "Welcome to Doni’s" &&
    text.contactBody.sv === "Njut av god mat, vackra omgivningar och en avslappnad atmosfär vid Hornsbergs Strand. Boka bord, ring oss eller kom förbi." &&
    text.contactBody.en === "Enjoy good food, beautiful surroundings and a relaxed atmosphere by Hornsbergs Strand. Book a table, call us or simply stop by." &&
    site.business.name === "Doni’s Trattoria" &&
    site.business.address === "Hornsbergs Strand 77" &&
    site.business.postalCode === "112 16" &&
    site.business.city === "Stockholm" &&
    site.business.phone === "08-656 84 00" &&
    site.business.email === "donitrattoria@gmail.com" &&
    site.business.instagram === "@donis.trattoria" &&
    site.business.instagramUrl === "https://www.instagram.com/donis.trattoria/" &&
    site.business.orgNumber === "556852-1420" &&
    site.business.mapUrl === "https://www.google.com/maps/search/?api=1&query=Doni%27s+Trattoria+Hornsbergs+Strand+77+Stockholm" &&
    text.foundedYear === null &&
    !site.links.booking &&
    !site.links.order &&
    site.hours.every((hour) => hour.closed)
  );
}
