import type { Metadata } from "next";

import { SwedishLegalPage } from "@/components/marketing/swedish-legal-page";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Cookieinformation för Proffera och hur cookies kan användas i tjänsten.",
};

const sections = [
  { title: "1. Vad är cookies?", text: "Cookies är små textfiler som kan sparas i webbläsaren för att en webbplats ska fungera, komma ihåg val eller mäta användning." },
  { title: "2. Nödvändiga cookies", text: "Proffera kan använda nödvändiga cookies eller liknande teknik för säkerhet, adminåtkomst och teknisk drift. Dessa behövs för att tjänsten ska fungera korrekt." },
  { title: "3. Valfri analys", text: "När analyskonfiguration finns erbjuder Proffera valfri, begränsad produktanalys via PostHog. Analysen startar först efter att du uttryckligen har valt att tillåta den. Vi använder inte denna analys för reklam eller marknadsföringsspårning." },
  { title: "4. Hantera cookies och analys", text: "Du kan ändra ditt val för analys via Analysinställningar i Proffera. Du kan också normalt ta bort eller blockera cookies och lokal lagring i webbläsarens inställningar. Vissa funktioner kan fungera sämre om nödvändig lagring blockeras." },
  { title: "5. Nuvarande status", text: "Utöver nödvändig lagring kan Proffera, efter uttryckligt samtycke, använda lokal lagring för begränsad analys. Analysen är begränsad till sidvisningar, tekniska sessionsidentifierare, sanerade sidvägar och en grov hänvisningskälla. Frågesträngar, URL-fragment, formulärtext och personuppgifter ska inte skickas till analysen." },
] as const;

export default function CookiesPage() {
  return <SwedishLegalPage title="Cookies" introduction="Den här sidan beskriver hur Proffera använder cookies och liknande teknik för drift, säkerhet och valfri analys." sections={sections} englishHref="/en/cookies" notice="Den här sidan beskriver nuvarande användning av nödvändig lagring och valfri analys." />;
}
