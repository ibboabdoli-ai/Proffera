import { mainNav } from "./site";

export type PublicLocale = "sv" | "en";

type LocalizedRoute = {
  sv: string;
  en: string;
};

const localizedRoutes = [
  { sv: "/", en: "/en" },
  { sv: "/for-foretag", en: "/en/for-business" },
  { sv: "/tjanster", en: "/en/services" },
  { sv: "/branscher", en: "/en/industries" },
  { sv: "/priser", en: "/en/pricing" },
  { sv: "/demo", en: "/en/demo" },
  { sv: "/skapa-konto", en: "/en/create-account" },
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
] as const;

export const localeCopy = {
  sv: {
    homeLabel: "Proffera startsida",
    navigationLabel: "Huvudmeny",
    mobileNavigationLabel: "Huvudmeny mobil",
    menuLabel: "Meny",
    loginLabel: "Logga in",
    primaryCtaLabel: "Starta gratis i 14 dagar",
    languageLabel: "Byt till engelska",
    footerDescription: "Visa tjänster, ta emot bokningar och offertförfrågningar och hantera kunder, uppdrag och uppföljning i ett tydligt arbetsflöde.",
    footerStatus: "För tjänsteföretag som vill samla kundresan i ett system.",
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
    primaryCtaLabel: "Start free 14-day trial",
    languageLabel: "Switch to Swedish",
    footerDescription: "Show services, receive bookings and quote requests, and manage customers, jobs and follow-up in one clear workflow.",
    footerStatus: "For service businesses that want the customer journey in one system.",
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
