import type { Metadata } from "next";
import { Mail, MapPin, MessageSquare } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = {
  title: {
    absolute: "Kontakt – Boka demo av Proffera",
  },
  description:
    "Kontakta Proffera för demo, pilotkund eller frågor om bokningssystem, CRM, leadhantering och AI-assistent för företag.",
};

export default function ContactPage() {
  return (
    <div className="overflow-hidden bg-[#f7f7f4]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]">Kontakt</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-[#17201a] sm:text-5xl">
          Vill du se hur Proffera fungerar för ditt företag?
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">
          Boka en demo så visar vi bokning, leads, CRM och AI-assistent i ett enkelt flöde.
        </p>
        <div className="mt-8">
          <ButtonLink href="/demo">Boka demo</ButtonLink>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div className="rounded-2xl bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10">
          <h2 className="text-2xl font-bold">Kontaktuppgifter</h2>
          <div className="mt-6 space-y-5 text-sm text-white/75">
            <p className="flex gap-3"><Mail className="h-5 w-5 text-[#a9dbb9]" aria-hidden="true" /> leads@proffera.se</p>
            <p className="flex gap-3"><MapPin className="h-5 w-5 text-[#a9dbb9]" aria-hidden="true" /> Sverige</p>
            <p className="flex gap-3"><MessageSquare className="h-5 w-5 text-[#a9dbb9]" aria-hidden="true" /> Demo och pilotkunder</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd]">
          <h2 className="text-2xl font-bold text-[#17201a]">Boka demo eller mejla oss</h2>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">
            Berätta kort om företaget, vilka tjänster ni erbjuder och vilket flöde ni vill förbättra. Vi återkommer med förslag på demo eller pilotupplägg.
          </p>
          <div className="mt-6 rounded-xl bg-[#fbfbf8] p-5 text-sm text-[#344139] ring-1 ring-[#dfe5dd]">
            <p className="font-semibold text-[#17201a]">Bra information att skicka:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Företagsnamn, bransch och stad</li>
              <li>Om ni vill testa bokning, leads, CRM eller AI-chatt</li>
              <li>Telefonnummer eller e-post för uppföljning</li>
            </ul>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/demo">Boka demo</ButtonLink>
            <a className="inline-flex min-h-11 w-fit items-center rounded-xl border border-[#17452f] bg-white px-5 py-3 text-sm font-semibold text-[#17452f]" href="mailto:leads@proffera.se?subject=Demo%20Proffera">
              Skicka e-post
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
