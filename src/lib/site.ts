export const siteConfig = {
  name: "Proffera",
  description:
    "Proffera hjälper kunder i Sverige att beskriva sitt uppdrag och jämföra svar från relevanta företag.",
  url: "https://proffera.se",
  primaryCta: "Beskriv ditt uppdrag",
  providerCta: "Anslut företag",
};

export const mainNav = [
  { label: "Få offert", href: "/fa-offert" },
  { label: "Hur det fungerar", href: "/hur-det-fungerar" },
  { label: "Kategorier", href: "/kategorier" },
  { label: "Anslut företag", href: "/anslut-foretag" },
  { label: "Kontakt", href: "/kontakt" },
] as const;

export const serviceCategories = [
  "Hemstädning",
  "Flyttstädning",
  "Kontorsstädning",
  "Fönsterputs",
  "Byggstädning",
  "Trädgård",
  "Flytthjälp",
  "Renovering",
] as const;
