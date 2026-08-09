export type BookingThemeKey = "clean" | "modern" | "salon" | "premium" | "minimal" | "restaurant";
export type BookingThemeLanguage = "sv" | "en";

export type BookingThemeServiceSample = {
  name: string;
  description: string;
};

export type BookingThemeLocalizedContent = {
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  ctaLabel: string;
  faqTitle: string;
  faqBody: string;
  serviceSamples: BookingThemeServiceSample[];
};

export type BookingThemeTemplate = {
  key: BookingThemeKey;
  name: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  appearance: "light" | "dark";
  heroImageUrl: string;
  content: Record<BookingThemeLanguage, BookingThemeLocalizedContent>;
};

export type BookingThemeContentOverride = Partial<{
  heroTitleSv: string;
  heroTitleEn: string;
  heroSubtitleSv: string;
  heroSubtitleEn: string;
  heroDescriptionSv: string;
  heroDescriptionEn: string;
  ctaLabelSv: string;
  ctaLabelEn: string;
  faqTitleSv: string;
  faqTitleEn: string;
  faqBodySv: string;
  faqBodyEn: string;
  heroImageUrl: string;
}>;

export type BookingThemeContentOverrides = Partial<Record<BookingThemeKey, BookingThemeContentOverride>>;

export type ResolvedBookingThemeContent = BookingThemeLocalizedContent & {
  heroImageUrl: string;
};

export const BOOKING_THEME_TEMPLATES: Record<BookingThemeKey, BookingThemeTemplate> = {
  clean: {
    key: "clean",
    name: "Clean",
    description: "Ljus och trygg",
    primaryColor: "#17452f",
    accentColor: "#d9b44a",
    appearance: "light",
    heroImageUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=2200&q=82",
    content: {
      sv: {
        heroTitle: "Enklare bokning. Bättre service.",
        heroSubtitle: "Professionellt, tydligt och tryggt",
        heroDescription: "Boka en tjänst på några minuter och få all information samlad på ett ställe.",
        ctaLabel: "Boka tid",
        faqTitle: "När är bokningen registrerad?",
        faqBody: "Bokningen registreras efter att kunden har verifierat sin e-postadress.",
        serviceSamples: [
          { name: "Standardtjänst", description: "Smidig bokning med tydlig tid och prisinformation." },
          { name: "Hembesök", description: "För tjänster som utförs hos kunden." },
          { name: "Kostnadsfri konsultation", description: "Ett första samtal innan arbetet planeras." },
        ],
      },
      en: {
        heroTitle: "Simple booking. Better service.",
        heroSubtitle: "Professional, clear and reliable",
        heroDescription: "Book a service in minutes and keep all important information in one place.",
        ctaLabel: "Book now",
        faqTitle: "When is the booking registered?",
        faqBody: "The booking is registered after the customer verifies their email address.",
        serviceSamples: [
          { name: "Standard service", description: "Easy booking with clear time and price information." },
          { name: "On-site visit", description: "For services delivered at the customer's location." },
          { name: "Free consultation", description: "A first conversation before the work is planned." },
        ],
      },
    },
  },
  modern: {
    key: "modern",
    name: "Modern",
    description: "Digital och tydlig",
    primaryColor: "#0b6678",
    accentColor: "#8fcbd6",
    appearance: "light",
    heroImageUrl: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=2200&q=82",
    content: {
      sv: {
        heroTitle: "Smart bokning för moderna företag.",
        heroSubtitle: "Snabbt, digitalt och strukturerat",
        heroDescription: "Låt kunderna hitta rätt tjänst, tid och kontaktväg utan onödiga steg.",
        ctaLabel: "Se lediga tider",
        faqTitle: "Hur fungerar onlinebokningen?",
        faqBody: "Kunden väljer tjänst och tid, verifierar sin e-post och får därefter bokningen registrerad.",
        serviceSamples: [
          { name: "Digital rådgivning", description: "Boka ett digitalt möte med rätt specialist." },
          { name: "Konsultation", description: "Planera behov, nästa steg och leverans." },
          { name: "Supportmöte", description: "Få hjälp med ett pågående ärende." },
        ],
      },
      en: {
        heroTitle: "Smart booking for modern businesses.",
        heroSubtitle: "Fast, digital and structured",
        heroDescription: "Help customers find the right service, time and contact path without unnecessary steps.",
        ctaLabel: "See availability",
        faqTitle: "How does online booking work?",
        faqBody: "The customer selects a service and time, verifies their email, and the booking is then registered.",
        serviceSamples: [
          { name: "Digital advisory", description: "Book an online meeting with the right specialist." },
          { name: "Consultation", description: "Plan needs, next steps and delivery." },
          { name: "Support meeting", description: "Get help with an ongoing case." },
        ],
      },
    },
  },
  salon: {
    key: "salon",
    name: "Salon",
    description: "Mjuk och personlig för frisör och beauty",
    primaryColor: "#843a5a",
    accentColor: "#e8b7ca",
    appearance: "light",
    heroImageUrl: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=2200&q=82",
    content: {
      sv: {
        heroTitle: "Din stil. Vårt hantverk.",
        heroSubtitle: "Kvalitet, passion och personlig service",
        heroDescription: "Boka klippning, färgning eller styling hos din favoritfrisör. En enkel bokning för en bättre salongsupplevelse.",
        ctaLabel: "Boka tid",
        faqTitle: "Kan jag välja frisör?",
        faqBody: "Ja. När salongen har publicerat sina medarbetare kan du välja en tillgänglig frisör i bokningen.",
        serviceSamples: [
          { name: "Klippning", description: "Personlig konsultation, klippning och styling." },
          { name: "Färgning", description: "Färgbehandling anpassad efter hår och önskat resultat." },
          { name: "Styling", description: "Styling för vardag, fest eller ett särskilt tillfälle." },
          { name: "Skäggtrimning", description: "Formning och trimning med ett välvårdat resultat." },
        ],
      },
      en: {
        heroTitle: "Your style. Our craft.",
        heroSubtitle: "Quality, passion and personal service",
        heroDescription: "Book a haircut, coloring or styling appointment with your preferred stylist. Simple booking for a better salon experience.",
        ctaLabel: "Book appointment",
        faqTitle: "Can I choose a stylist?",
        faqBody: "Yes. When the salon has published its team, you can choose an available stylist during booking.",
        serviceSamples: [
          { name: "Haircut", description: "Personal consultation, haircut and styling." },
          { name: "Hair coloring", description: "Color treatment adapted to your hair and desired result." },
          { name: "Styling", description: "Styling for everyday wear, events or special occasions." },
          { name: "Beard trim", description: "Shaping and trimming for a polished result." },
        ],
      },
    },
  },
  premium: {
    key: "premium",
    name: "Premium",
    description: "Mörk och exklusiv",
    primaryColor: "#17130f",
    accentColor: "#b69257",
    appearance: "dark",
    heroImageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2200&q=82",
    content: {
      sv: {
        heroTitle: "En exklusiv upplevelse från första bokningen.",
        heroSubtitle: "Premium service med personlig känsla",
        heroDescription: "Presentera dina mest värdefulla tjänster i en mörk, elegant och förtroendeingivande miljö.",
        ctaLabel: "Boka exklusiv tid",
        faqTitle: "Vad ingår i en premiumbokning?",
        faqBody: "Det exakta innehållet styrs av företagets tjänster och visas i samband med bokningen.",
        serviceSamples: [
          { name: "Premium konsultation", description: "Personlig genomgång med extra tid och fokus." },
          { name: "Signature service", description: "Företagets utvalda premiumbehandling eller tjänst." },
          { name: "Privat bokning", description: "En mer avskild bokningsupplevelse för särskilda behov." },
        ],
      },
      en: {
        heroTitle: "A premium experience from the first booking.",
        heroSubtitle: "Premium service with a personal touch",
        heroDescription: "Present your most valuable services in a dark, elegant and confidence-building setting.",
        ctaLabel: "Book premium service",
        faqTitle: "What is included in a premium booking?",
        faqBody: "The exact content is defined by the company's services and shown during booking.",
        serviceSamples: [
          { name: "Premium consultation", description: "A personal session with extra time and focus." },
          { name: "Signature service", description: "The company's selected premium treatment or service." },
          { name: "Private booking", description: "A more private booking experience for specific needs." },
        ],
      },
    },
  },
  minimal: {
    key: "minimal",
    name: "Minimal",
    description: "Ren och avskalad",
    primaryColor: "#184f39",
    accentColor: "#d6e3db",
    appearance: "light",
    heroImageUrl: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=2200&q=82",
    content: {
      sv: {
        heroTitle: "Boka. Klart.",
        heroSubtitle: "En ren och enkel bokningsupplevelse",
        heroDescription: "Fokus på det viktigaste: tjänsten, tiden och kontakten med företaget.",
        ctaLabel: "Boka",
        faqTitle: "Vad händer efter bokningen?",
        faqBody: "Efter e-postverifiering registreras bokningen och du får information om nästa steg.",
        serviceSamples: [
          { name: "Tjänst 01", description: "Tydlig tjänst med tid och pris." },
          { name: "Tjänst 02", description: "Enkel bokning utan onödiga steg." },
          { name: "Tjänst 03", description: "Flexibelt alternativ för fler behov." },
        ],
      },
      en: {
        heroTitle: "Book. Done.",
        heroSubtitle: "A clean and simple booking experience",
        heroDescription: "Focus on what matters: the service, the time and the connection with the business.",
        ctaLabel: "Book",
        faqTitle: "What happens after booking?",
        faqBody: "After email verification, the booking is registered and you receive information about the next step.",
        serviceSamples: [
          { name: "Service 01", description: "A clear service with time and price." },
          { name: "Service 02", description: "Simple booking without unnecessary steps." },
          { name: "Service 03", description: "A flexible option for additional needs." },
        ],
      },
    },
  },
  restaurant: {
    key: "restaurant",
    name: "Restaurant",
    description: "Varm och elegant",
    primaryColor: "#5b2a1d",
    accentColor: "#d9aa68",
    appearance: "dark",
    heroImageUrl: "https://images.unsplash.com/photo-1753019491860-128b7763f8ee?auto=format&fit=crop&w=2200&q=82",
    content: {
      sv: {
        heroTitle: "God mat. Bra stämning. Minnen att dela.",
        heroSubtitle: "Välkommen till en enklare restaurangupplevelse",
        heroDescription: "Njut av omsorgsfullt lagad mat i en varm miljö. Boka bord, grupp eller event direkt online.",
        ctaLabel: "Boka bord",
        faqTitle: "När är bokningen bekräftad?",
        faqBody: "Bokningen registreras efter e-postverifiering och följer restaurangens bekräftelseflöde.",
        serviceSamples: [
          { name: "Bordsbokning", description: "Boka bord för lunch eller middag." },
          { name: "Gruppbokning", description: "För större sällskap och planerade middagar." },
          { name: "Eventförfrågan", description: "Skicka en förfrågan för privata event och företagsevent." },
        ],
      },
      en: {
        heroTitle: "Great food. Good atmosphere. Memories to share.",
        heroSubtitle: "Welcome to a smoother restaurant experience",
        heroDescription: "Enjoy carefully prepared food in a warm setting. Book a table, group or event directly online.",
        ctaLabel: "Book a table",
        faqTitle: "When is the booking confirmed?",
        faqBody: "The booking is registered after email verification and follows the restaurant's confirmation flow.",
        serviceSamples: [
          { name: "Table booking", description: "Book a table for lunch or dinner." },
          { name: "Group booking", description: "For larger parties and planned dinners." },
          { name: "Event inquiry", description: "Send an inquiry for private or corporate events." },
        ],
      },
    },
  },
};

export const BOOKING_THEME_KEYS = Object.keys(BOOKING_THEME_TEMPLATES) as BookingThemeKey[];

export function isBookingThemeKey(value: string): value is BookingThemeKey {
  return Object.prototype.hasOwnProperty.call(BOOKING_THEME_TEMPLATES, value);
}

function cleanString(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, maxLength);
}

export function normalizeBookingThemeContentOverrides(value: unknown): BookingThemeContentOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: BookingThemeContentOverrides = {};
  for (const key of BOOKING_THEME_KEYS) {
    const raw = source[key];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const normalized: BookingThemeContentOverride = {};
    const textFields: Array<keyof BookingThemeContentOverride> = [
      "heroTitleSv", "heroTitleEn", "heroSubtitleSv", "heroSubtitleEn", "heroDescriptionSv", "heroDescriptionEn",
      "ctaLabelSv", "ctaLabelEn", "faqTitleSv", "faqTitleEn", "faqBodySv", "faqBodyEn", "heroImageUrl",
    ];
    for (const field of textFields) {
      const valueForField = cleanString(item[field], field === "heroImageUrl" ? 3000 : 2000);
      if (valueForField) normalized[field] = valueForField;
    }
    if (Object.keys(normalized).length) result[key] = normalized;
  }
  return result;
}

export function resolveBookingThemeContent(
  themeKeyInput: string,
  language: BookingThemeLanguage,
  overridesInput?: BookingThemeContentOverrides,
): ResolvedBookingThemeContent {
  const themeKey: BookingThemeKey = isBookingThemeKey(themeKeyInput) ? themeKeyInput : "clean";
  const template = BOOKING_THEME_TEMPLATES[themeKey];
  const base = template.content[language];
  const override = overridesInput?.[themeKey] ?? {};
  const suffix = language === "sv" ? "Sv" : "En";
  const pick = (field: "heroTitle" | "heroSubtitle" | "heroDescription" | "ctaLabel" | "faqTitle" | "faqBody") => {
    const key = `${field}${suffix}` as keyof BookingThemeContentOverride;
    return cleanString(override[key]) || base[field];
  };
  return {
    heroTitle: pick("heroTitle"),
    heroSubtitle: pick("heroSubtitle"),
    heroDescription: pick("heroDescription"),
    ctaLabel: pick("ctaLabel"),
    faqTitle: pick("faqTitle"),
    faqBody: pick("faqBody"),
    heroImageUrl: cleanString(override.heroImageUrl, 3000) || template.heroImageUrl,
    serviceSamples: base.serviceSamples,
  };
}

export function withBookingThemeContentOverride(
  overridesInput: BookingThemeContentOverrides,
  themeKey: BookingThemeKey,
  override: BookingThemeContentOverride | null,
): BookingThemeContentOverrides {
  const current = normalizeBookingThemeContentOverrides(overridesInput);
  const next = { ...current };
  if (!override || !Object.keys(override).length) delete next[themeKey];
  else next[themeKey] = normalizeBookingThemeContentOverrides({ [themeKey]: override })[themeKey] ?? {};
  return next;
}
