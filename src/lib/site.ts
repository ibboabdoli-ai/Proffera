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
    "Proffera är en svensk SaaS-plattform som hjälper små tjänsteföretag att hantera leads, bokningar och kunder i ett tydligt arbetsflöde.",
  url: "https://proffera.se",
  primaryCta: "Boka demo",
  providerCta: "Se priser",
};

export const mainNav = [
  { label: "Tjänster", href: "/tjanster" },
  { label: "Branscher", href: "/branscher" },
  { label: "Priser", href: "/priser" },
  { label: "Demo", href: "/demo" },
  { label: "Om", href: "/om" },
  { label: "Kontakt", href: "/kontakt" },
] as const;

export const serviceCategories = [
  "Onlinebokning",
  "AI-chattassistent (planerad)",
  "QR-bokning",
  "Leadhantering",
  "Kund-CRM",
  "Automatiska bekräftelser",
  "Påminnelser (planerad)",
  "Digitala formulär",
  "Webbplats för företag",
  "Affärsautomation (planerad)",
] as const;

export const pricingPlans = [
  {
    name: "Starter",
    price: "Från 299 kr/mån",
    description: "För små företag som vill komma igång med digitala förfrågningar och bokningar.",
    features: ["Bokningsflöde", "E-postnotiser", "Kontaktformulär", "Grundläggande leadlista"],
  },
  {
    name: "Professional",
    price: "Från 699 kr/mån",
    description: "För växande företag som vill samla leads, kunder och bokningar i ett system.",
    features: ["Allt i Starter", "Kund-CRM", "Bokningshistorik", "Tjänstekatalog", "Automatiska bokningsbekräftelser"],
  },
  {
    name: "Business",
    price: "Offert",
    description: "För företag med flera team, orter eller behov av anpassade integrationer.",
    features: ["Allt i Professional", "Prioriterad support", "Flera platser", "Anpassade integrationer"],
  },
] as const;
