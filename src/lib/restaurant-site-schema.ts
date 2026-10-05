import { z } from "zod";

const localized = z.object({
  sv: z.string().trim().max(2000),
  en: z.string().trim().max(2000),
});
const image = z.object({ id: z.string().uuid(), alt: localized });

export const restaurantContactDefaults = {
  addressLine1: "Hornsbergs Strand 77",
  postalCity: "112 16 Stockholm",
  phone: "08-656 84 00",
  email: "donitrattoria@gmail.com",
  instagram: "@donis.trattoria",
  orgNumber: "556852-1420",
} as const;

const contact = z.object({
  addressLine1: z.string().trim().max(180),
  postalCity: z.string().trim().max(120),
  phone: z.string().trim().max(80),
  email: z.string().trim().max(180),
  instagram: z.string().trim().max(180),
  orgNumber: z.string().trim().max(80),
});

const httpsUrlOrEmpty = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => {
    if (!value) return true;
    if (!/^https:\/\//i.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && Boolean(url.hostname);
    } catch {
      return false;
    }
  });

export const restaurantSiteSchema = z.object({
  categories: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: localized,
        sortOrder: z.number().int().nonnegative(),
        hidden: z.boolean(),
      }),
    )
    .max(40),
  dishes: z
    .array(
      z.object({
        id: z.string().uuid(),
        categoryId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        nameEn: z.string().trim().max(120).optional(),
        priceOre: z.number().int().min(0).max(10000000).nullable(),
        description: localized,
        image: image.nullable(),
        sortOrder: z.number().int().nonnegative(),
        hidden: z.boolean(),
        archived: z.boolean(),
      }),
    )
    .max(500),
  media: z.object({
    hero: image.nullable(),
    gallery: z
      .array(
        image.extend({
          kind: z.enum([
            "interior",
            "exterior",
            "atmosphere",
            "food",
            "family",
          ]),
          sortOrder: z.number().int().nonnegative(),
        }),
      )
      .max(50)
      .refine(
        (items) => new Set(items.map((item) => item.id)).size === items.length,
        "Galleriet får inte innehålla samma bild flera gånger.",
      ),
    owner: image.nullable(),
    family: image.nullable(),
  }),
  text: z.object({
    heroTitle: localized,
    heroDescription: localized,
    aboutTitle: localized,
    story: localized,
    ownerIntroduction: localized,
    philosophy: localized,
    foundedYear: z.number().int().min(1800).max(2100).nullable(),
  }),
  hours: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        closed: z.boolean(),
        open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      }),
    )
    .length(7),
  links: z.object({
    booking: httpsUrlOrEmpty,
    order: httpsUrlOrEmpty,
  }),
  contact: contact.optional(),
});

export type RestaurantSite = z.infer<typeof restaurantSiteSchema>;

const blank = () => ({ sv: "", en: "" });
export const emptyRestaurantSite: RestaurantSite = {
  categories: [],
  dishes: [],
  media: { hero: null, gallery: [], owner: null, family: null },
  text: {
    heroTitle: blank(),
    heroDescription: blank(),
    aboutTitle: blank(),
    story: blank(),
    ownerIntroduction: blank(),
    philosophy: blank(),
    foundedYear: null,
  },
  hours: Array.from({ length: 7 }, (_, day) => ({
    day,
    closed: true,
    open: "10:30",
    close: "21:00",
  })),
  links: { booking: "", order: "" },
  contact: { ...restaurantContactDefaults },
};

export function validateRestaurantSite(value: unknown) {
  const result = restaurantSiteSchema.safeParse(value);
  if (!result.success)
    return { ok: false as const, error: "Kontrollera fälten och försök igen." };
  const site = result.data;
  const categoryIds = new Set(site.categories.map((category) => category.id));
  if (
    categoryIds.size !== site.categories.length ||
    new Set(site.dishes.map((dish) => dish.id)).size !== site.dishes.length ||
    site.dishes.some((dish) => !categoryIds.has(dish.categoryId)) ||
    new Set(site.hours.map((hour) => hour.day)).size !== 7
  ) {
    return {
      ok: false as const,
      error: "Menyn eller öppettiderna innehåller ogiltiga referenser.",
    };
  }
  if (site.links.booking) {
    const bookingUrl = new URL(site.links.booking);
    const bookingHost = bookingUrl.hostname.toLowerCase();
    const bookingPath = bookingUrl.pathname;
    const isGoogleHost =
      /^(?:www\.|maps\.)?google\.(?:com|[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2})$/i.test(
        bookingHost,
      );
    const isGoogleReserve =
      isGoogleHost && /^\/maps\/reserve(?:\/|$)/i.test(bookingPath);
    const isMapsShortLink =
      bookingHost === "maps.app.goo.gl" ||
      (bookingHost === "goo.gl" && /^\/maps(?:\/|$)/i.test(bookingPath));
    const isGoogleMapsDestination =
      !isGoogleReserve &&
      ((bookingHost === "maps.google.com" ||
        bookingHost.startsWith("maps.google.")) ||
        (isGoogleHost && /^\/maps(?:\/|$)/i.test(bookingPath)));

    if (isMapsShortLink || isGoogleMapsDestination) {
      return {
        ok: false as const,
        error:
          "Bokningslänken måste gå direkt till bokningsflödet, inte till en karta.",
      };
    }
  }
  return { ok: true as const, site };
}
