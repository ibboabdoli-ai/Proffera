import { ArrowRight, CheckCircle2, ShieldCheck, Star } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { serviceCategories, siteConfig } from "@/lib/site";

const steps = [
  "Beskriv vad du behöver hjälp med",
  "Vi matchar uppdraget med relevanta företag",
  "Jämför svar och välj det som känns bäst",
] as const;

export default function HomePage() {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-24">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#17452f] shadow-sm">
            Ny svensk offertplattform för lokala tjänster
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl lg:text-6xl">
            Beskriv ditt uppdrag och jämför svar från relevanta företag.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5b665f]">
            Proffera hjälper privatpersoner och företag att hitta rätt hjälp för städning, flytt, trädgård och renovering. Enkelt, tydligt och byggt för den svenska marknaden.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/fa-offert">{siteConfig.primaryCta}</ButtonLink>
            <ButtonLink href="/anslut-foretag" variant="secondary">
              Anslut ditt företag
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl shadow-black/5 ring-1 ring-[#dfe5dd]">
          <div className="flex items-center gap-3 border-b border-[#dfe5dd] pb-4">
            <ShieldCheck className="h-6 w-6 text-[#17452f]" aria-hidden="true" />
            <div>
              <p className="font-semibold">Trygg jämförelse</p>
              <p className="text-sm text-[#5b665f]">Fokusera på rätt företag, rätt tjänst och rätt område.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {serviceCategories.map((category) => (
              <div key={category} className="flex items-center justify-between rounded-2xl border border-[#dfe5dd] px-4 py-3">
                <span className="font-medium text-[#17201a]">{category}</span>
                <ArrowRight className="h-4 w-4 text-[#17452f]" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step} className="rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#17452f] font-bold text-white">{index + 1}</span>
                <h2 className="mt-5 text-xl font-semibold">{step}</h2>
                <p className="mt-3 text-sm leading-6 text-[#5b665f]">
                  Ett tydligt steg i flödet som gör det lättare att gå från behov till jämförbara svar.
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            [CheckCircle2, "Relevanta företag", "Matchning efter tjänst, stad och serviceområde."],
            [Star, "Tydlig jämförelse", "Jämför svar, profil och omdömen när flödet byggs ut."],
            [ShieldCheck, "Kontrollerad process", "Admin kan granska uppdrag och företag i kommande faser."],
          ].map(([Icon, title, text]) => (
            <article key={String(title)} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <Icon className="h-7 w-7 text-[#17452f]" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-semibold">{String(title)}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5b665f]">{String(text)}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
