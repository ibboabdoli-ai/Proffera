import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Kontakta Proffera om plattformen, företag eller kommande offertflöde.",
};

export default function ContactPage() {
  return (
    <PageShell
      eyebrow="Kontakt"
      title="Kontakta Proffera"
      description="Kontaktformulär och supportflöde läggs till i en senare fas. Tills dess används den här sidan som tydlig kontaktplats i strukturen."
    >
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <p className="text-sm font-semibold text-[#17452f]">Planerat innehåll</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[#5b665f]">
          <li>Kontaktformulär</li>
          <li>Support för kunder</li>
          <li>Support för företag</li>
          <li>Information om dataskydd och begäran om radering</li>
        </ul>
      </div>
    </PageShell>
  );
}
