import { ShieldCheck, Sparkles, Target } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

const values = [
  { icon: Target, title: "Byggt för små företag", text: "Proffera fokuserar på vardagliga behov: leads, bokningar, kunder och uppföljning." },
  { icon: Sparkles, title: "Moduler med tydlig status", text: "Planerade funktioner markeras som planerade och aktiveras inte automatiskt för kunders arbetsytor." },
  { icon: ShieldCheck, title: "Svensk och tydlig process", text: "Plattformen byggs stegvis med fokus på säkerhet, tydlighet och lokala tjänsteföretag." },
];

export default function AboutPage() {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Om Proffera</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">
          Vi bygger ett enklare sätt för tjänsteföretag att växa digitalt.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">
          Proffera började som ett lead- och offertflöde och utvecklas stegvis till en SaaS-plattform för svenska småföretag.
        </p>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-3 lg:px-8">
        {values.map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <Icon className="h-8 w-8 text-[#17452f]" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold text-[#17201a]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5b665f]">{text}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dfe5dd]">
          <h2 className="text-2xl font-bold text-[#17201a]">Nästa steg</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5b665f]">
            Vi bygger vidare med publika sidor, dashboard, bokningsflöde, CRM och abonnemang på ett kontrollerat sätt. Planerade moduler lanseras först när de är klara för användning.
          </p>
          <div className="mt-6">
            <ButtonLink href="/kontakt">Prata med oss</ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
