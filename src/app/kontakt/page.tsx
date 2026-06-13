import type { Metadata } from "next";
import { Mail, MapPin, MessageSquare } from "lucide-react";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Kontakta Proffera för demo, pilotkund eller frågor om SaaS-plattformen.",
};

export default function ContactPage() {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Kontakt</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">
          Vill du se hur Proffera kan fungera för ditt företag?
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">
          Kontakta oss för demo, pilotkund eller frågor om bokning, CRM och AI-driven kundkommunikation.
        </p>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h2 className="text-2xl font-bold text-[#17201a]">Kontaktuppgifter</h2>
          <div className="mt-6 space-y-4 text-sm text-[#344139]">
            <p className="flex gap-3"><Mail className="h-5 w-5 text-[#17452f]" aria-hidden="true" /> leads@proffera.se</p>
            <p className="flex gap-3"><MapPin className="h-5 w-5 text-[#17452f]" aria-hidden="true" /> Sverige</p>
            <p className="flex gap-3"><MessageSquare className="h-5 w-5 text-[#17452f]" aria-hidden="true" /> Demo och pilotkunder</p>
          </div>
        </div>

        <form className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h2 className="text-2xl font-bold text-[#17201a]">Skicka intresseanmälan</h2>
          <p className="mt-2 text-sm text-[#5b665f]">Formuläret är en visuell demo i denna fas. Skicka e-post direkt tills kontaktflödet kopplas till backend.</p>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-[#17201a]">
              Namn
              <input className="rounded-xl border border-[#dfe5dd] px-4 py-3" placeholder="Ditt namn" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#17201a]">
              E-post
              <input className="rounded-xl border border-[#dfe5dd] px-4 py-3" placeholder="namn@foretag.se" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#17201a]">
              Meddelande
              <textarea className="min-h-32 rounded-xl border border-[#dfe5dd] px-4 py-3" placeholder="Berätta kort vad du vill se i Proffera" />
            </label>
            <a className="inline-flex w-fit rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white" href="mailto:leads@proffera.se?subject=Demo%20Proffera">
              Skicka via e-post
            </a>
          </div>
        </form>
      </section>
    </div>
  );
}
