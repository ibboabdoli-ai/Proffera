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
      description: {
        sv: "Ett exempel från restaurangens tidigare presentation. Aktuellt innehåll och pris uppdateras av restaurangen.",
        en: "An example from the restaurant’s previous presentation. Current content and price are maintained by the restaurant.",
      },
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
      description: {
        sv: "En av rätterna som presenterats av Doni’s tidigare.",
        en: "One of the dishes previously presented by Doni’s.",
      },
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
      description: {
        sv: "Pasta från restaurangens tidigare urval.",
        en: "Pasta from the restaurant’s previous selection.",
      },
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
      description: {
        sv: "Pasta från restaurangens tidigare urval.",
        en: "Pasta from the restaurant’s previous selection.",
      },
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
      description: {
        sv: "En rätt som tidigare visats på Doni’s webbplats.",
        en: "A dish previously shown on Doni’s website.",
      },
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
      description: {
        sv: "Ett exempel på den mindre europeiska delen av menyn.",
        en: "An example from the smaller European section of the menu.",
      },
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
    foundedYear: null,
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
