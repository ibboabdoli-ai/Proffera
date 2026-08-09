import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Globe2,
  LayoutDashboard,
  Star,
  Users,
} from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import type { PublicLocale } from "@/lib/public-locale";

type DemoStep = {
  icon: LucideIcon;
  title: string;
  text: string;
  details: string[];
};

const copy = {
  sv: {
    eyebrow: "Demo",
    title: "Se hela kundresan – från tjänstesida till uppföljning",
    intro: "Demon fokuserar på det som redan finns i Proffera: hur kunden hittar en tjänst, bokar eller begär offert och hur företaget fortsätter med CRM, uppdrag, omdömen och analys.",
    primary: "Skicka demoförfrågan",
    secondary: "Starta gratis i 14 dagar",
    note: "Demoförfrågan är kostnadsfri och skapar ingen betalning.",
    steps: [
      {
        icon: Globe2,
        title: "1. Företagssida och tjänster",
        text: "Vi visar hur ett företag presenterar sina tjänster och låter varje tjänst ha rätt nästa steg.",
        details: ["Företagssida", "Tjänstekort och tjänstesidor", "Boka / begär offert / kontakta", "Galleri och omdömen"],
      },
      {
        icon: CalendarCheck2,
        title: "2. Bokning och offert",
        text: "Vi går igenom både den direkta bokningsvägen och jobb som först behöver en offertförfrågan.",
        details: ["Tjänst → ledig tid", "Kunduppgifter", "Offertförfrågan kopplad till tjänsten", "Kundens självservice"],
      },
      {
        icon: LayoutDashboard,
        title: "3. Dashboard, CRM och uppdrag",
        text: "Sedan följer vi samma kund in i företagets arbetsyta där historik och operativt arbete hålls samman.",
        details: ["Leads och kunder", "Kundhistorik", "Bokningar och offerter", "Uppdrag och status"],
      },
      {
        icon: BarChart3,
        title: "4. Uppföljning och analys",
        text: "Till sist visar vi hur ett slutfört jobb kan fortsätta till omdöme och hur den publika kundytan kan följas upp med analys.",
        details: ["Verifierade omdömen", "Tjänstevisningar", "Boknings-, offert- och kontaktklick", "30-dagars översikt"],
      },
    ] satisfies DemoStep[],
    flowEyebrow: "Exempel på demo",
    flowTitle: "En kund, ett sammanhängande flöde",
    flow: [
      { icon: Globe2, label: "Ser en tjänst" },
      { icon: FileText, label: "Bokar eller begär offert" },
      { icon: Users, label: "Skapas eller återanvänds i CRM" },
      { icon: ClipboardCheck, label: "Jobbet drivs till klart" },
      { icon: Star, label: "Följs upp med omdöme" },
    ],
    fitTitle: "Demon anpassas efter hur ditt företag arbetar",
    fitText: "Har du främst bokningar visar vi den vägen. Jobbar du mer med offertförfrågningar fokuserar vi på offert → kund → uppdrag. Målet är att du ska kunna bedöma Proffera utifrån ditt verkliga kundflöde.",
    finalTitle: "Vill du gå igenom ditt flöde med oss?",
    finalText: "Skicka en kort demoförfrågan. Om du hellre vill testa själv kan du starta en 14-dagars provperiod direkt.",
    finalPrimary: "Skicka demoförfrågan",
    finalSecondary: "Starta gratis",
  },
  en: {
    eyebrow: "Demo",
    title: "See the whole customer journey – from service page to follow-up",
    intro: "The demo focuses on what already exists in Proffera: how customers discover a service, book or request a quote, and how the business continues with CRM, jobs, reviews and analytics.",
    primary: "Request a demo",
    secondary: "Start free 14-day trial",
    note: "The demo request is free and does not create a payment.",
    steps: [
      {
        icon: Globe2,
        title: "1. Business page and services",
        text: "We show how a business presents its services and gives each service the right next step.",
        details: ["Business page", "Service cards and service pages", "Book / quote / contact", "Gallery and reviews"],
      },
      {
        icon: CalendarCheck2,
        title: "2. Booking and quotes",
        text: "We walk through both the direct booking path and jobs that first need a quote request.",
        details: ["Service → available time", "Customer details", "Quote request linked to the service", "Customer self-service"],
      },
      {
        icon: LayoutDashboard,
        title: "3. Dashboard, CRM and jobs",
        text: "Then we follow the same customer into the business workspace where history and operational work stay connected.",
        details: ["Leads and customers", "Customer history", "Bookings and quotes", "Jobs and status"],
      },
      {
        icon: BarChart3,
        title: "4. Follow-up and analytics",
        text: "Finally, we show how a completed job can continue into a review and how the public customer surface can be measured with analytics.",
        details: ["Verified reviews", "Service views", "Booking, quote and contact clicks", "30-day overview"],
      },
    ] satisfies DemoStep[],
    flowEyebrow: "Demo example",
    flowTitle: "One customer, one connected flow",
    flow: [
      { icon: Globe2, label: "Views a service" },
      { icon: FileText, label: "Books or requests a quote" },
      { icon: Users, label: "Created or reused in CRM" },
      { icon: ClipboardCheck, label: "Job moves to completion" },
      { icon: Star, label: "Followed up with a review" },
    ],
    fitTitle: "The demo is adapted to how your business works",
    fitText: "If bookings are your main flow, we focus there. If you work more with quote requests, we focus on quote → customer → job. The goal is to evaluate Proffera against your real customer journey.",
    finalTitle: "Want to walk through your workflow with us?",
    finalText: "Send a short demo request. If you prefer to explore on your own, you can start a 14-day trial immediately.",
    finalPrimary: "Request a demo",
    finalSecondary: "Start free",
  },
} as const;

export function MarketingDemo({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const demoRequestHref = locale === "en" ? "/en/join-business/register" : "/anslut-foretag/registrera";
  const signupHref = locale === "en" ? "/en/create-account" : "/skapa-konto";

  return (
    <div className="overflow-hidden bg-[#f6f8f4]">
      <section className="relative border-b border-[#284336] bg-[#102a1c] text-white">
        <div className="absolute -right-20 -top-28 h-96 w-96 rounded-full bg-[#3e9b68]/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#b6d4c0]">{t.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">{t.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/75">{t.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><ButtonLink href={demoRequestHref}>{t.primary}</ButtonLink><ButtonLink href={signupHref} variant="secondary">{t.secondary}</ButtonLink></div>
          <p className="mt-4 text-sm font-semibold text-white/60">{t.note}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-2">{t.steps.map(({ icon: Icon, title, text, details }) => <article key={title} className="rounded-[1.8rem] border border-[#dfe5dd] bg-white p-6 shadow-sm sm:p-7"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf2ec] text-[#17452f]"><Icon className="h-6 w-6" /></span><h2 className="mt-5 text-2xl font-black tracking-tight text-[#17201a]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#667168]">{text}</p><ul className="mt-5 grid gap-2 sm:grid-cols-2">{details.map((detail) => <li key={detail} className="flex items-start gap-2 rounded-xl bg-[#f7f9f6] p-3 text-sm font-semibold text-[#344139]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7b53]" />{detail}</li>)}</ul></article>)}</div>
      </section>

      <section className="border-y border-[#e1e7df] bg-white py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><p className="text-sm font-black uppercase tracking-[0.14em] text-[#17452f]">{t.flowEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17201a]">{t.flowTitle}</h2><div className="mt-8 grid gap-3 lg:grid-cols-5">{t.flow.map(({ icon: Icon, label }, index) => <article key={label} className="relative rounded-2xl border border-[#dfe5dd] bg-[#fafcf9] p-5"><Icon className="h-5 w-5 text-[#17452f]" /><p className="mt-4 text-sm font-black leading-6 text-[#17201a]">{label}</p>{index < t.flow.length - 1 ? <ArrowRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-[#8ba395] lg:block" /> : null}</article>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-6 rounded-[2rem] bg-[#eef4ef] p-8 sm:p-10 lg:grid-cols-[.7fr_1.3fr] lg:items-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#173e2b] text-white"><LayoutDashboard className="h-7 w-7" /></span><div><h2 className="text-3xl font-black tracking-tight text-[#17201a]">{t.fitTitle}</h2><p className="mt-3 max-w-3xl text-base leading-7 text-[#5b665f]">{t.fitText}</p></div></div></section>

      <section className="border-t border-[#e1e7df] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><div><h2 className="text-3xl font-black tracking-tight text-[#17201a]">{t.finalTitle}</h2><p className="mt-3 max-w-2xl text-base leading-7 text-[#5b665f]">{t.finalText}</p></div><div className="flex flex-col gap-3 sm:flex-row"><ButtonLink href={demoRequestHref}>{t.finalPrimary}</ButtonLink><ButtonLink href={signupHref} variant="secondary">{t.finalSecondary}</ButtonLink></div></div></section>
    </div>
  );
}
