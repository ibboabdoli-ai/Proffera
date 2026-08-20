export const chatLinks = {
  app: "https://chat.proffera.se/app/inbox?tenant=proffera",
  demo: "https://chat.proffera.se/demo?tenant=proffera",
  settings: "https://chat.proffera.se/app/settings?tenant=proffera",
  widgetInstall: "https://chat.proffera.se/app/widget-install?tenant=proffera",
  widgetConfig: "https://chat.proffera.se/api/widget-config?clientId=proffera",
} as const;

export const siteConfig = {
  name: "Proffera",
  description:
    "Proffera hjälper tjänsteföretag att visa tjänster, ta emot bokningar och offertförfrågningar och hantera kunder, uppdrag och uppföljning i ett tydligt arbetsflöde.",
  url: "https://www.proffera.se",
  primaryCta: "Starta gratis i 14 dagar",
  providerCta: "Se priser",
};

export const mainNav = [
  { label: "Funktioner", href: "/tjanster" },
  { label: "Branscher", href: "/branscher" },
  { label: "Priser", href: "/priser" },
  { label: "Demo", href: "/demo" },
] as const;

export const serviceCategories = [
  "Onlinebokning",
  "Leadhantering",
  "Kund-CRM",
  "Offerter",
  "Kundportal",
  "Företagssida",
  "Galleri",
  "Verifierade omdömen",
  "Analys",
  "Påminnelser",
] as const;

export const pricingPlans = [
  {
    name: "Starter",
    price: "199 kr/mån",
    description: "För små företag som vill samla bokningar, leads och kunder i ett system.",
    features: ["Onlinebokning", "Leadhantering", "Kund-CRM", "Kundportal", "Påminnelser"],
  },
  {
    name: "Professional",
    price: "599 kr/mån",
    description: "För företag som vill visa tjänster online och hantera fler delar av kundresan i Proffera.",
    features: ["Allt i Starter", "Företagssida", "Offerter", "Galleri och verifierade omdömen", "Analys", "Flera medarbetare"],
  },
  {
    name: "Enterprise",
    price: "Anpassat pris",
    description: "För större eller mer avancerade upplägg med behov utöver standardflödet.",
    features: ["Allt i Professional", "Egen domän", "Avancerade arbetsflöden", "Anpassad uppsättning", "Prioriterad dialog"],
  },
] as const;
