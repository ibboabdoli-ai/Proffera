import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Hur det fungerar",
  description: "Så hjälper Proffera kunder att beskriva uppdrag och jämföra svar från företag.",
};

const steps = [
  "Välj tjänst och område",
  "Beskriv uppdraget i ett guidat flöde",
  "Jämför svar från relevanta företag",
] as const;

export default function HowItWorksPage() {
  return (
    <PageShell
      eyebrow="Så fungerar det"
      title="Från behov till jämförbara svar i tre tydliga steg."
      description="Proffera byggs för att göra offertprocessen enklare, mer strukturerad och mer transparent för både kunder och företag."
      ctaLabel="Beskriv ditt uppdrag"
      ctaHref="/fa-offert"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <article key={step} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <span className="text-sm font-semibold text-[#17452f]">Steg {index + 1}</span>
            <h2 className="mt-3 text-lg font-semibold">{step}</h2>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
