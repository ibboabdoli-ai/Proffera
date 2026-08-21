import type { GuestFlowLocale } from "../../svara/[token]/guest-flow-locale";

export const guestQuoteTestCopy = {
  sv: {
    metadataTitle: "Guest Quote-test | Proffera",
    language: "English",
    unavailableTitle: "Testlänken kan inte användas",
    unavailableBody: "Den är ogiltig eller har gått ut.",
    eyebrow: "Proffera · Test",
    title: "Guest Quote-länken fungerar",
    body: "Detta är en kontrollerad e-post- och länktest. Ingen kund, offertförfrågan, företagsprofil eller avregistrering har skapats eller ändrats.",
    expiry: "Testets giltighet",
  },
  en: {
    metadataTitle: "Guest Quote test | Proffera",
    language: "Svenska",
    unavailableTitle: "This test link cannot be used",
    unavailableBody: "It is invalid or has expired.",
    eyebrow: "Proffera · Test",
    title: "The Guest Quote link works",
    body: "This is a controlled email and link test. No customer, quote request, business profile, or opt-out record has been created or changed.",
    expiry: "Test validity",
  },
} as const;

export function guestQuoteTestHref(token: string, locale: GuestFlowLocale) {
  const path = `/offert/testa/${encodeURIComponent(token)}`;
  return locale === "en" ? `${path}?lang=en` : path;
}
