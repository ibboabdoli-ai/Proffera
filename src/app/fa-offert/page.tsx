import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { serviceCategories } from "@/lib/site";

export const metadata: Metadata = {
  title: "Få offert",
  description: "Starta ett uppdrag hos Proffera och förbered en offertförfrågan.",
};

export default function QuotePage() {
  return (
    <PageShell
      eyebrow="Få offert"
      title="Beskriv ditt uppdrag. Formuläret byggs i nästa fas."
      description="Den här sidan är en placeholder för det kommande flerstegsformuläret. I nästa fas byggs kategorival, plats, beskrivning, kontaktuppgifter och samtycke."
    >
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <h2 className="text-xl font-semibold">Planerade tjänstekategorier</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {serviceCategories.map((category) => (
            <div key={category} className="rounded-2xl border border-[#dfe5dd] px-4 py-3 font-medium">
              {category}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
