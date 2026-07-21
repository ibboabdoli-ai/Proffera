import type { Metadata } from "next";
import { ArrowRight, Bot, CalendarCheck, MailCheck, QrCode, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { serviceCategories } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: "Tjänster – Digital bokning och CRM för företag",
  },
  description:
    "Utforska Profferas moduler för onlinebokning, leadhantering, kund-CRM, automatiska mejl och QR-bokning. AI-assistenten är planerad.",
};

const highlights = [
  { icon: CalendarCheck, title: "Onlinebokning", text: "Låt kunder boka tid eller skicka förfrågan direkt från företagets webbplats." },
  { icon: Bot, title: "AI-chattassistent (planerad)", text: "Förbereds för framtida kunddialog och leadfångst. Ingår inte i den aktiva portalen ännu." },
  { icon: Users, title: "Kund-CRM", text: "Samla kunduppgifter, historik och uppföljning på ett ställe." },
  { icon: MailCheck, title: "Automatiska mejl", text: "Skicka bekräftelser, interna notifieringar och uppföljningar utan manuellt arbete." },
  { icon: QrCode, title: "QR-bokning", text: "Gör det enkelt att starta bokning från skyltar, visitkort, fordon eller annonser." },
];

export default function ServicesPage() {
  return (
    <div className="overflow-hidden bg-[#f7f7f4]">
      <section className="border-b border-[#dfe5dd] bg-[radial-gradient(circle_at_85%_0%,rgba(145,197,162,0.28),transparent_35%),linear-gradient(180deg,#fff_0%,#f7f7f4_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]">Tjänster</p>
        <h1 className="mt-4 max-w-4xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-[#17201a] sm:text-5xl">
          Digitala verktyg för tjänsteföretag som vill växa smartare.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">
          Proffera kombinerar bokning, leadhantering och CRM i ett system byggt för små företag i Sverige. AI-stöd och mer automation byggs vidare stegvis.
        </p>
      </div></section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-5 lg:px-8">
          {highlights.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-6 transition hover:-translate-y-1 hover:border-[#b6cfbd] hover:bg-white hover:shadow-lg hover:shadow-[#17452f]/5">
              <div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f1eb]"><Icon className="h-5 w-5 text-[#17452f]" aria-hidden="true" /></div><span className="text-sm font-bold text-[#9aa69e]">0{index + 1}</span></div>
              <h2 className="mt-6 text-lg font-semibold text-[#17201a]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5b665f]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-[#17201a]">Moduler</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {serviceCategories.map((category) => (
            <div key={category} className="flex items-center justify-between rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-[#dfe5dd] transition hover:-translate-y-0.5 hover:ring-[#b6cfbd]">
              <span className="font-medium text-[#17201a]">{category}</span>
              <ArrowRight className="h-4 w-4 text-[#17452f]" aria-hidden="true" />
            </div>
          ))}
        </div>
        <div className="mt-10">
          <ButtonLink href="/demo">Boka demo</ButtonLink>
        </div>
      </section>
    </div>
  );
}
