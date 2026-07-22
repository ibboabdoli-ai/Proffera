import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Villkor",
  description: "Användarvillkor för Proffera och användning av plattformens tjänster.",
};

const sections = [
  {
    title: "1. Om tjänsten",
    text: "Proffera är en digital plattform för svenska tjänsteföretag. Tjänsten omfattar de moduler som uttryckligen aktiverats för kundens arbetsyta, till exempel leadhantering, bokningar, kundhantering, e-postnotiser och administrativa arbetsflöden.",
  },
  {
    title: "2. Användning",
    text: "Användare ska lämna korrekta uppgifter och får inte använda tjänsten för spam, bedrägeri, olagligt innehåll eller försök att kringgå säkerhetsfunktioner.",
  },
  {
    title: "3. Företagsregistrering",
    text: "Företag som ansluter sig ansvarar för att information om företagsnamn, organisationsnummer, kontaktperson, tjänster och serviceområden är korrekt och uppdaterad.",
  },
  {
    title: "4. Leads och förfrågningar",
    text: "Proffera kan hjälpa till att ta emot och vidarebefordra leads eller offertförfrågningar. Proffera garanterar inte att varje lead leder till uppdrag, bokning eller intäkt.",
  },
  {
    title: "5. E-post och kommunikation",
    text: "Plattformen kan skicka e-postnotiser till företag eller administratörer. Användare ansvarar för att kontaktuppgifter är riktiga och att mottagna förfrågningar hanteras professionellt.",
  },
  {
    title: "6. Priser och abonnemang",
    text: "Pris, vald plan, betalningsperiod och eventuella skatter visas innan ett abonnemang bekräftas. Betalning och hantering av abonnemang sker via Stripe när den funktionen har aktiverats för arbetsytan. Uppsägning och ändringar hanteras i Stripe-portalen och gäller enligt den bekräftade betalningsperioden.",
  },
  {
    title: "7. Tillgänglighet och ändringar",
    text: "Proffera kan uppdatera eller ändra tjänsten. Planerade eller separata moduler är inte en del av kundens aktiva tjänst förrän de uttryckligen har aktiverats. Driftstörningar kan förekomma, men vi arbetar för att begränsa deras påverkan.",
  },
  {
    title: "8. Ansvarsbegränsning",
    text: "Proffera ansvarar inte för indirekta skador, uteblivna affärer, felaktiga uppgifter från användare eller avtal som ingås mellan kund och företag utanför plattformen.",
  },
  {
    title: "9. Kontakt och frågor",
    text: "Frågor om dessa villkor eller om den aktiva tjänsten kan skickas till leads@proffera.se.",
  },
];

export default function TermsPage() {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Juridiskt</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">Villkor</h1>
        <p className="mt-5 text-lg leading-8 text-[#5b665f]">
          Dessa villkor beskriver den övergripande användningen av Proffera som digital plattform för leads, bokningar och företagsflöden.
        </p>
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#5b665f] ring-1 ring-[#dfe5dd]">
          Senast uppdaterad: 22 juli 2026. Kundspecifika villkor eller personuppgiftsbiträdesavtal kan komplettera dessa villkor.
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
