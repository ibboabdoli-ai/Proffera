export type PublicBusinessLocale = "sv" | "en";

type PublicBusinessLanguageSettings = {
  defaultLanguage: PublicBusinessLocale;
  swedishEnabled: boolean;
  englishEnabled: boolean;
};

export function firstPublicBusinessLocaleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolvePublicBusinessLocale(
  settings: PublicBusinessLanguageSettings,
  requested?: string,
): PublicBusinessLocale {
  const requestedLocale: PublicBusinessLocale | null =
    requested === "en" ? "en" : requested === "sv" ? "sv" : null;

  if (requestedLocale === "en" && settings.englishEnabled) return "en";
  if (requestedLocale === "sv" && settings.swedishEnabled) return "sv";

  if (settings.defaultLanguage === "en" && settings.englishEnabled) return "en";
  if (settings.defaultLanguage === "sv" && settings.swedishEnabled) return "sv";
  if (settings.englishEnabled) return "en";
  return "sv";
}

export function withPublicBusinessLocale(href: string, locale: PublicBusinessLocale) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return href;
  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}lang=${locale}${hash}`;
}

export const publicBusinessCopy = {
  sv: {
    languageSwitch: "English",
    languageSwitchLabel: "Visa sidan på engelska",
    company: {
      bookTime: "Boka tid",
      heroEyebrow: "Tjänster nära dig",
      defaultIntro: "Se våra tjänster, välj det som passar och boka eller skicka en offertförfrågan direkt.",
      seeServices: "Se tjänster",
      bookOnline: "Boka online",
      contactUs: "Kontakta oss",
      servicesEyebrow: "Våra tjänster",
      servicesTitle: "Vad kan vi hjälpa dig med?",
      servicesLead: "Välj en tjänst för mer information, pris och nästa steg.",
      serviceFallback: "Läs mer om tjänsten och se hur du går vidare.",
      serviceMode: {
        book: "Bokningsbar online",
        quote: "Offertförfrågan",
        book_or_quote: "Bokning eller offert",
        contact: "Kontaktförfrågan",
      },
      viewService: "Visa tjänsten",
      noServices: "Företaget har inte publicerat några tjänster ännu.",
      galleryEyebrow: "Galleri",
      galleryTitle: "Tidigare arbete",
      reviewsEyebrow: "Omdömen",
      reviewsTitle: "Vad kunder säger",
      contactEyebrow: "Kontakt",
      contactTitle: "Redo att ta nästa steg?",
      contactLead: (companyName: string) => `Skicka en förfrågan direkt till ${companyName}. Den sparas i företagets Proffera-arbetsyta så att den kan följas upp.`,
      directContact: "Direktkontakt",
      footer: "Digital kundresa via Proffera",
    },
    service: {
      backTo: (companyName: string) => `Till ${companyName}`,
      fallback: "Kontakta företaget för mer information om tjänsten.",
      bookOnline: "Boka online",
      requestQuote: "Begär offert",
      contact: "Kontakta",
      about: "Om tjänsten",
      quoteEyebrow: "Offert",
      quoteTitle: "Beskriv vad du behöver",
      quoteLead: (companyName: string, serviceName: string) => `Din förfrågan går direkt till ${companyName} och kopplas till tjänsten ${serviceName}.`,
      contactEyebrow: "Kontaktförfrågan",
      contactTitle: "Skicka en fråga om tjänsten",
      contactLead: (companyName: string) => `Förfrågan sparas direkt hos ${companyName} i Proffera för uppföljning.`,
      contactDetails: "Kontaktuppgifter",
      footer: "Digital kundresa via Proffera",
    },
    contactForm: {
      success: "Tack! Din förfrågan är skickad. Företaget kan nu följa upp den i Proffera.",
      name: "Namn",
      email: "E-post",
      phone: "Telefon",
      optional: "(valfritt)",
      message: "Meddelande",
      error: "Förfrågan kunde inte skickas. Försök igen om en stund.",
      sending: "Skickar…",
      submit: "Skicka förfrågan",
    },
    quoteForm: {
      aria: (serviceName: string) => `Begär offert för ${serviceName}`,
      name: "Namn",
      email: "E-post",
      phone: "Telefon",
      city: "Ort",
      postalCode: "Postnummer",
      preferredDate: "Önskat datum",
      preferredDatePlaceholder: "Till exempel nästa vecka",
      description: "Beskriv vad du behöver",
      success: "Tack! Förfrågan är skickad",
      reference: "Referens",
      error: "Förfrågan kunde inte skickas just nu. Kontrollera uppgifterna och försök igen.",
      sending: "Skickar…",
      submit: "Skicka offertförfrågan",
    },
  },
  en: {
    languageSwitch: "Svenska",
    languageSwitchLabel: "Show this page in Swedish",
    company: {
      bookTime: "Book",
      heroEyebrow: "Services near you",
      defaultIntro: "Explore our services, choose what fits and book online or send a quote request directly.",
      seeServices: "View services",
      bookOnline: "Book online",
      contactUs: "Contact us",
      servicesEyebrow: "Our services",
      servicesTitle: "How can we help?",
      servicesLead: "Choose a service to see details, pricing and the next step.",
      serviceFallback: "Read more about the service and see how to continue.",
      serviceMode: {
        book: "Bookable online",
        quote: "Quote request",
        book_or_quote: "Booking or quote",
        contact: "Contact request",
      },
      viewService: "View service",
      noServices: "The company has not published any services yet.",
      galleryEyebrow: "Gallery",
      galleryTitle: "Previous work",
      reviewsEyebrow: "Reviews",
      reviewsTitle: "What customers say",
      contactEyebrow: "Contact",
      contactTitle: "Ready to take the next step?",
      contactLead: (companyName: string) => `Send a request directly to ${companyName}. It is saved in the company's Proffera workspace for follow-up.`,
      directContact: "Direct contact",
      footer: "Digital customer journey via Proffera",
    },
    service: {
      backTo: (companyName: string) => `Back to ${companyName}`,
      fallback: "Contact the company for more information about this service.",
      bookOnline: "Book online",
      requestQuote: "Request a quote",
      contact: "Contact",
      about: "About the service",
      quoteEyebrow: "Quote",
      quoteTitle: "Tell us what you need",
      quoteLead: (companyName: string, serviceName: string) => `Your request goes directly to ${companyName} and is linked to ${serviceName}.`,
      contactEyebrow: "Contact request",
      contactTitle: "Ask a question about this service",
      contactLead: (companyName: string) => `The request is saved directly with ${companyName} in Proffera for follow-up.`,
      contactDetails: "Contact details",
      footer: "Digital customer journey via Proffera",
    },
    contactForm: {
      success: "Thank you! Your request has been sent. The company can now follow it up in Proffera.",
      name: "Name",
      email: "Email",
      phone: "Phone",
      optional: "(optional)",
      message: "Message",
      error: "The request could not be sent. Please try again in a moment.",
      sending: "Sending…",
      submit: "Send request",
    },
    quoteForm: {
      aria: (serviceName: string) => `Request a quote for ${serviceName}`,
      name: "Name",
      email: "Email",
      phone: "Phone",
      city: "City",
      postalCode: "Postal code",
      preferredDate: "Preferred date",
      preferredDatePlaceholder: "For example, next week",
      description: "Describe what you need",
      success: "Thank you! Your request has been sent",
      reference: "Reference",
      error: "The request could not be sent right now. Check the details and try again.",
      sending: "Sending…",
      submit: "Send quote request",
    },
  },
} as const;
