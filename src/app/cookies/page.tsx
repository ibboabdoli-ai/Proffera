import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Cookieinformation för Proffera och hur cookies kan användas i tjänsten.",
};

const sections = [
  {
    title: "1. Vad är cookies?",
    text: "Cookies är små textfiler som kan sparas i webbläsaren för att en webbplats ska fungera, komma ihåg val eller mäta användning.",
  },
  {
    title: "2. Nödvändiga cookies",
    text: "Proffera kan använda nödvändiga cookies eller liknande teknik för säkerhet, adminåtkomst och teknisk drift. Dessa behövs för att tjänsten ska fungera korrekt.",
  },
  {
    title: "3. Analys och marknadsföring",
    text: "Om analysverktyg eller marknadsföringscookies införs i framtiden ska cookieinformationen uppdateras och samtycke hanteras där det krävs.",
  },
  {
    title: "4. Hantera cookies",
    text: "Du kan normalt ta bort eller blockera cookies i webbläsarens inställningar. Vissa funktioner kan fungera sämre om nödvändiga cookies blockeras.",
  },
  {
    title: "5. Nuvarande status",
    text: "Proffera använder för närvarande endast nödvändiga cookies eller liknande teknik för säkerhet, inloggning och drift. Om analys eller externa spårningsverktyg tas i bruk uppdateras denna sida och samtycke hanteras när det krävs.",
  },
];

export default function CookiesPage() {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Juridiskt</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">Cookies</h1>
        <p className="mt-5 text-lg leading-8 text-[#5b665f]">
          Den här sidan beskriver hur Proffera använder cookies och liknande teknik för drift och säkerhet.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="space-y-4">
          {sections.map((section) => (
            <article key={section.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <h2 className="text-xl font-semibold text-[#17201a]">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#5b665f]">{section.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
