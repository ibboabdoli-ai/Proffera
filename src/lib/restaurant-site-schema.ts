import { z } from "zod";

const localized = z.object({
  sv: z.string().trim().max(2000),
  en: z.string().trim().max(2000),
});
const image = z.object({ id: z.string().uuid(), alt: localized });

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
      .max(50),
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
    booking: z
      .url({ protocol: /^https:$/ })
      .max(1000)
      .or(z.literal("")),
    order: z
      .url({ protocol: /^https:$/ })
      .max(1000)
      .or(z.literal("")),
  }),
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
  if (
    site.links.booking &&
    /\/maps(?:\/|$)/i.test(new URL(site.links.booking).pathname)
  ) {
    return {
      ok: false as const,
      error:
        "Bokningslänken måste gå direkt till bokningsflödet, inte till en karta.",
    };
  }
  return { ok: true as const, site };
}
