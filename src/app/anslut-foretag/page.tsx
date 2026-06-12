import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Anslut företag",
  description: "Information för företag som vill ta emot relevanta uppdrag via Proffera.",
};

const benefits = [
  "Ta emot relevanta uppdrag i dina tjänsteområden",
  "Bygg en tydlig företagsprofil",
  "Svara på leads och följ status i dashboarden",
] as const;

export default function JoinCompanyPage() {
  return (
    <PageShell
      eyebrow="För företag"
      title="Få fler relevanta förfrågningar när företagsflödet öppnar."
      description="Proffera kommer att ge godkända företag ett strukturerat sätt att se matchade uppdrag, svara på leads och bygga förtroende genom profil och omdömen."
      ctaLabel="Kontakta oss"
      ctaHref="/kontakt"
    >
      <div className="grid gap-4 md:grid-cols-3">
        {benefits.map((benefit) => (
          <article key={benefit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <h2 className="text-lg font-semibold">{benefit}</h2>
          </article>
        ))}
      </div>
    </PageShell>
  );
}
