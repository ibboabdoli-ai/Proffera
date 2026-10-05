import { z } from "zod";

const localized = z.object({
  sv: z.string().trim().max(2000),
  en: z.string().trim().max(2000),
});
const image = z.object({ id: z.string().uuid(), alt: localized });

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

const emailOrEmpty = z
  .string()
  .trim()
  .max(320)
  .refine(
    (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    "Ange en giltig e-postadress.",
  );

const phoneOrEmpty = z
  .string()
  .trim()
  .max(60)
  .refine(
    (value) => {
      if (!value) return true;
      if (!/^\+?[\d\s().-]+$/.test(value)) return false;
      const digits = value.replace(/\D/g, "");
      return digits.length >= 6 && digits.length <= 15;
    },
    "Ange ett giltigt telefonnummer.",
  );

const instagramHandlePattern = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;

const normalizeInstagramHandle = (value: string) => value.replace(/^@/, "");

const instagramHandleOrEmpty = z
  .string()
  .trim()
  .max(31)
  .refine(
    (value) => {
      if (!value) return true;
      const handle = normalizeInstagramHandle(value);
      return handle.length <= 30 && instagramHandlePattern.test(handle);
    },
    "Ange ett giltigt Instagram-namn.",
  );

const instagramProfileFromUrl = (value: string) => {
  if (!value || !/^https:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      (hostname !== "instagram.com" && hostname !== "www.instagram.com")
    )
      return null;

    const segments = url.pathname.split("/").filter(Boolean);
    const profile = segments[0] ?? "";
    if (
      segments.length !== 1 ||
      profile.length > 30 ||
      !instagramHandlePattern.test(profile)
    )
      return null;

    return profile;
  } catch {
    return null;
  }
};

const instagramUrlOrEmpty = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (value) => !value || instagramProfileFromUrl(value) !== null,
    "Instagram-länken måste gå direkt till en giltig profil på instagram.com.",
  );

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
    menuTitle: localized.default({ sv: "Något för alla smaker", en: "Something for every taste" }),
    menuIntro: localized.default({ sv: "Antipasti, färsk pasta, surdegspizza, utvalda huvudrätter och drycker.", en: "Antipasti, fresh pasta, sourdough pizza, selected mains and drinks." }),
    galleryTitle: localized.default({ sv: "En smak av Doni’s", en: "A taste of Doni’s" }),
    galleryIntro: localized.default({ sv: "Mat, detaljer och stämning från Doni’s vid Hornsbergs Strand.", en: "Food, details and atmosphere from Doni’s by Hornsbergs Strand." }),
    contactTitle: localized.default({ sv: "Välkommen till oss", en: "Welcome to Doni’s" }),
    contactBody: localized.default({ sv: "Njut av god mat, vackra omgivningar och en avslappnad atmosfär vid Hornsbergs Strand. Boka bord, ring oss eller kom förbi.", en: "Enjoy good food, beautiful surroundings and a relaxed atmosphere by Hornsbergs Strand. Book a table, call us or simply stop by." }),
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
  business: z
    .object({
      name: z.string().trim().min(1).max(120),
      address: z.string().trim().max(240),
      postalCode: z.string().trim().max(24),
      city: z.string().trim().max(120),
      phone: phoneOrEmpty,
      email: emailOrEmpty,
      instagram: instagramHandleOrEmpty,
      instagramUrl: instagramUrlOrEmpty,
      orgNumber: z.string().trim().max(60),
      mapUrl: httpsUrlOrEmpty,
    })
    .superRefine((business, ctx) => {
      if (business.instagramUrl && !business.instagram) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["instagram"],
          message: "Ange Instagram-namnet när en Instagram-länk används.",
        });
        return;
      }
      if (!business.instagram || !business.instagramUrl) return;
      const handle = normalizeInstagramHandle(business.instagram).toLowerCase();
      const profile = instagramProfileFromUrl(business.instagramUrl)?.toLowerCase();
      if (profile !== handle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["instagramUrl"],
          message: "Instagram-länken måste matcha Instagram-namnet.",
        });
      }
    })
    .default({
    name: "Doni’s Trattoria",
    address: "Hornsbergs Strand 77",
    postalCode: "112 16",
    city: "Stockholm",
    phone: "08-656 84 00",
    email: "donitrattoria@gmail.com",
    instagram: "@donis.trattoria",
    instagramUrl: "https://www.instagram.com/donis.trattoria/",
    orgNumber: "556852-1420",
    mapUrl: "",
  }),
  links: z.object({
    booking: httpsUrlOrEmpty,
    order: httpsUrlOrEmpty,
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
    menuTitle: { sv: "Något för alla smaker", en: "Something for every taste" },
    menuIntro: { sv: "Antipasti, färsk pasta, surdegspizza, utvalda huvudrätter och drycker.", en: "Antipasti, fresh pasta, sourdough pizza, selected mains and drinks." },
    galleryTitle: { sv: "En smak av Doni’s", en: "A taste of Doni’s" },
    galleryIntro: { sv: "Mat, detaljer och stämning från Doni’s vid Hornsbergs Strand.", en: "Food, details and atmosphere from Doni’s by Hornsbergs Strand." },
    contactTitle: { sv: "Välkommen till oss", en: "Welcome to Doni’s" },
    contactBody: { sv: "Njut av god mat, vackra omgivningar och en avslappnad atmosfär vid Hornsbergs Strand. Boka bord, ring oss eller kom förbi.", en: "Enjoy good food, beautiful surroundings and a relaxed atmosphere by Hornsbergs Strand. Book a table, call us or simply stop by." },
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
    mapUrl: "",
  },
  hours: Array.from({ length: 7 }, (_, day) => ({    day,
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
