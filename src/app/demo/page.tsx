import type { Metadata } from "next";
import { Bot, CalendarDays, LayoutDashboard, QrCode } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = {
  title: {
    absolute: "Boka demo – Se Proffera för ditt tjänsteföretag",
  },
  description:
    "Boka en demo och se hur Proffera kan hjälpa ditt företag med bokningsflöde, leads, kundhantering och AI-chatt.",
};

const demoBlocks = [
  { icon: CalendarDays, title: "Interaktivt bokningsflöde", text: "Kunden väljer tjänst, beskriver behovet och skickar en tydlig förfrågan." },
  { icon: LayoutDashboard, title: "Adminöversikt", text: "Företaget ser leads, status, leveranslogg och uppföljningar i ett arbetsflöde." },
  { icon: Bot, title: "AI-assistent", text: "AI kan hjälpa besökare att hitta rätt tjänst och lämna kontaktuppgifter." },
  { icon: QrCode, title: "QR-bokning", text: "QR-koder kan leda direkt till en boknings- eller offertförfrågan." },
];

export default function DemoPage() {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Demo</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">
          Se hur Proffera kan fungera från första klick till uppföljning.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">
          Demo-sidan visar de centrala delarna: kundflöde, adminvy, AI-assistent och QR-bokning.
        </p>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        {demoBlocks.map(({ icon: Icon, title, text }) => (
          <article key={title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <Icon className="h-8 w-8 text-[#17452f]" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold text-[#17201a]">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#5b665f]">{text}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#17452f] p-8 text-white md:p-10">
          <h2 className="text-3xl font-bold">Vill du testa flödet med ditt företag?</h2>
          <p className="mt-3 max-w-2xl text-white/80">
            Skicka en förfrågan så kan vi gå igenom hur Proffera kan anpassas för tjänster, orter och kundflöden.
          </p>
          <div className="mt-6">
            <ButtonLink href="/kontakt" variant="secondary">Kontakta oss</ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
