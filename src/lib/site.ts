export const siteConfig = {
  name: "Proffera",
  description:
    "Proffera är en svensk SaaS-plattform som hjälper små tjänsteföretag att hantera leads, bokningar, kunder och AI-driven kommunikation.",
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
  "AI-chattassistent",
  "QR-bokning",
  "Leadhantering",
  "Kund-CRM",
  "Automatiska bekräftelser",
  "Påminnelser",
  "Digitala formulär",
  "Webbplats för företag",
  "Affärsautomation",
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
    description: "För växande företag som vill samla leads, kunder och AI-stöd i ett system.",
    features: ["Allt i Starter", "AI-chatt", "CRM", "Analysöversikt", "Automatiska bekräftelser"],
  },
  {
    name: "Business",
    price: "Offert",
    description: "För företag med flera team, orter eller behov av anpassade integrationer.",
    features: ["Allt i Professional", "Prioriterad support", "Flera platser", "Anpassade integrationer"],
  },
] as const;
