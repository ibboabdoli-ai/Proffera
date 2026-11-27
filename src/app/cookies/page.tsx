import type { Metadata } from "next";

import { SwedishLegalPage } from "@/components/marketing/swedish-legal-page";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Cookieinformation för Proffera och hur cookies kan användas i tjänsten.",
};

const sections = [
  { title: "1. Vad är cookies?", text: "Cookies är små textfiler som kan sparas i webbläsaren för att en webbplats ska fungera, komma ihåg val eller mäta användning." },
  { title: "2. Nödvändiga cookies", text: "Proffera kan använda nödvändiga cookies eller liknande teknik för säkerhet, adminåtkomst och teknisk drift. Dessa behövs för att tjänsten ska fungera korrekt." },
  { title: "3. Hantera cookies", text: "Du kan normalt ta bort eller blockera cookies och lokal lagring i webbläsarens inställningar. Vissa funktioner kan fungera sämre om nödvändig lagring blockeras." },
] as const;

export default function CookiesPage() {
  return <SwedishLegalPage title="Cookies" introduction="Den här sidan beskriver hur Proffera använder cookies och liknande teknik för drift och säkerhet." sections={sections} englishHref="/en/cookies" notice="Valfri produktanalys via PostHog är avstängd på Proffera." />;
}
