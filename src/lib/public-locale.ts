import { mainNav } from "./site";

export type PublicLocale = "sv" | "en";

type LocalizedRoute = {
  sv: string;
  en: string;
};

const localizedRoutes = [
  { sv: "/", en: "/en" },
  { sv: "/tjanster", en: "/en/services" },
  { sv: "/branscher", en: "/en/industries" },
  { sv: "/priser", en: "/en/pricing" },
  { sv: "/demo", en: "/en/demo" },
  { sv: "/om", en: "/en/about" },
  { sv: "/kontakt", en: "/en/contact" },
  { sv: "/anslut-foretag", en: "/en/join-business" },
  { sv: "/anslut-foretag/registrera", en: "/en/join-business/register" },
  { sv: "/anslut-foretag/tack", en: "/en/join-business/thank-you" },
  { sv: "/integritetspolicy", en: "/en/privacy" },
  { sv: "/villkor", en: "/en/terms" },
  { sv: "/cookies", en: "/en/cookies" },
] as const satisfies readonly LocalizedRoute[];

export const englishMainNav = [
  { label: "Features", href: "/en/services" },
  { label: "Industries", href: "/en/industries" },
  { label: "Pricing", href: "/en/pricing" },
  { label: "Demo", href: "/en/demo" },
  { label: "About", href: "/en/about" },
  { label: "Contact", href: "/en/contact" },
] as const;

export const localeCopy = {
  sv: {
    homeLabel: "Proffera startsida",
    navigationLabel: "Huvudmeny",
    mobileNavigationLabel: "Huvudmeny mobil",
    menuLabel: "Meny",
    loginLabel: "Logga in",
    primaryCtaLabel: "Boka demo",
    languageLabel: "Byt till engelska",
    footerDescription: "En svensk SaaS-plattform för tjänsteföretag som vill hantera leads, bokningar och kunder i ett tydligt arbetsflöde.",
    footerStatus: "Byggs stegvis för små företag i Sverige.",
    footerNavigation: "Navigering",
    footerLegal: "Juridiskt",
    legalLinks: [
      { label: "Integritetspolicy", href: "/integritetspolicy" },
      { label: "Villkor", href: "/villkor" },
      { label: "Cookies", href: "/cookies" },
    ],
    copyright: "Alla rättigheter förbehållna.",
  },
  en: {
    homeLabel: "Proffera home",
    navigationLabel: "Main navigation",
    mobileNavigationLabel: "Mobile main navigation",
    menuLabel: "Menu",
    loginLabel: "Log in",
    primaryCtaLabel: "Book a demo",
    languageLabel: "Switch to Swedish",
    footerDescription: "A Swedish SaaS platform for service businesses that want to manage leads, bookings and customers in one clear workflow.",
    footerStatus: "Built step by step for small businesses in Sweden.",
    footerNavigation: "Navigation",
    footerLegal: "Legal",
    legalLinks: [
      { label: "Privacy", href: "/en/privacy" },
      { label: "Terms", href: "/en/terms" },
      { label: "Cookies", href: "/en/cookies" },
    ],
    copyright: "All rights reserved.",
  },
} as const;

export function getPublicLocale(pathname: string | null | undefined): PublicLocale {
  return pathname === "/en" || pathname?.startsWith("/en/") ? "en" : "sv";
}

export function getPublicNavigation(locale: PublicLocale) {
  return locale === "en" ? englishMainNav : mainNav;
}

export function getLocalizedRoute(swedishPath: string, locale: PublicLocale) {
  return localizedRoutes.find((route) => route.sv === swedishPath)?.[locale] ?? swedishPath;
}

export function getAlternateLocalePath(pathname: string | null | undefined) {
  const normalizedPathname = pathname?.replace(/\/$/, "") || "/";
  const route = localizedRoutes.find(
    (candidate) => candidate.sv === normalizedPathname || candidate.en === normalizedPathname,
  );

  if (!route) return null;

  return route.en === normalizedPathname ? route.sv : route.en;
}

export function isEnglishPublicPath(pathname: string) {
  return pathname === "/en" || pathname.startsWith("/en/");
}

export const localizedPublicRoutes = localizedRoutes;
