import { CheckCircle2, Quote, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

const trustItems = [
  "Svensk SaaS för tjänsteföretag",
  "Byggt stegvis med säker adminåtkomst",
  "Fungerande lead- och e-postflöde i MVP",
  "Brevo-baserad e-postleverans",
] as const;

const testimonials = [
  {
    quote: "Proffera samlar det som annars hamnar i mejl, formulär och manuella listor.",
    name: "Pilotkund inom lokal service",
  },
  {
    quote: "Det tydligaste värdet är att leads, uppföljning och kunddialog får ett gemensamt flöde.",
    name: "Småföretagare i Stockholmsområdet",
  },
] as const;

const faqs = [
  {
    question: "Är Proffera en offertplattform eller ett SaaS-system?",
    answer: "Proffera började som ett lead- och offertflöde men byggs nu vidare som SaaS för bokningar, CRM, AI-kommunikation och uppföljning.",
  },
  {
    question: "Vilka företag passar Proffera för?",
    answer: "Små tjänsteföretag inom exempelvis städning, service, flytt, underhåll och lokala uppdrag där leads och bokningar behöver följas upp bättre.",
  },
  {
    question: "Finns allt klart redan?",
    answer: "MVP-flöden för leads, företag, matchning, admin och e-postleverans finns. SaaS-moduler byggs stegvis för att hålla kvalitet och kontroll.",
  },
  {
    question: "Kan Proffera anpassas för olika branscher?",
    answer: "Ja. Planen är att kunna anpassa tjänster, frågor, bokningsflöde, notifieringar och AI-svar efter varje bransch.",
  },
] as const;

export function ConversionSections() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Varför Proffera</p>
            <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Byggt för att konvertera fler förfrågningar till riktiga kunddialoger.</h2>
            <p className="mt-4 text-sm leading-7 text-[#5b665f]">
              Många småföretag tappar affärer för att leads hamnar i fel kanal, saknar struktur eller inte följs upp i tid. Proffera ger ett tydligare flöde från första kontakt till bokning.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {trustItems.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]">
                <ShieldCheck className="h-5 w-5 shrink-0 text-[#17452f]" aria-hidden="true" />
                <span className="text-sm font-medium text-[#17201a]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            <article className="rounded-3xl bg-[#f7f7f4] p-6 ring-1 ring-[#dfe5dd] lg:col-span-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Case study</p>
              <h2 className="mt-2 text-2xl font-bold text-[#17201a]">Från manuell leadhantering till strukturerat flöde.</h2>
              <p className="mt-3 text-sm leading-7 text-[#5b665f]">
                Ett lokalt serviceföretag kan använda Proffera för att ta emot förfrågningar, se matchade leads, skicka e-post och följa upp status i admin.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#344139]">
                {['Lead in', 'Matchning', 'E-postleverans', 'Uppföljning'].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#17452f]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <div className="grid gap-6 lg:col-span-2 md:grid-cols-2">
              {testimonials.map((item) => (
                <article key={item.name} className="rounded-3xl border border-[#dfe5dd] p-6">
                  <Quote className="h-7 w-7 text-[#17452f]" aria-hidden="true" />
                  <p className="mt-4 text-sm leading-7 text-[#344139]">“{item.quote}”</p>
                  <p className="mt-4 text-sm font-semibold text-[#17201a]">{item.name}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">FAQ</p>
            <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Vanliga frågor innan demo.</h2>
            <p className="mt-4 text-sm leading-7 text-[#5b665f]">
              Proffera byggs stegvis. Demo och pilotkunder används för att validera rätt funktioner innan större lansering.
            </p>
          </div>
          <div className="space-y-4">
            {faqs.map((item) => (
              <article key={item.question} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
                <h3 className="font-semibold text-[#17201a]">{item.question}</h3>
                <p className="mt-2 text-sm leading-7 text-[#5b665f]">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dfe5dd] md:flex md:items-center md:justify-between md:gap-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Nästa steg</p>
            <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Börja med en demo, inte ett långt projekt.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5b665f]">
              Vi går igenom företagets flöde, vilka leads som ska fångas och vilken automation som ger mest effekt först.
            </p>
          </div>
          <div className="mt-6 flex gap-3 md:mt-0">
            <ButtonLink href="/demo">Boka demo</ButtonLink>
            <ButtonLink href="/kontakt" variant="secondary">Kontakt</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
