import type { Metadata } from "next";
import { ArrowRight, CalendarCheck, CheckCircle2, MailCheck, QrCode, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { ConversionSections } from "@/components/marketing/conversion-sections";
import { pricingPlans, serviceCategories, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    absolute: "Proffera – Bokningssystem och CRM för tjänsteföretag",
  },
  description:
    "Proffera hjälper svenska tjänsteföretag att hantera bokningar, leads och kunder i ett enkelt SaaS-system.",
};

const dashboardItems = [
  { name: "Leads", status: "Aktiv modul" },
  { name: "Kunder", status: "Aktiv modul" },
  { name: "Bokningar", status: "Aktiv modul" },
  { name: "Analys", status: "Kommande modul" },
  { name: "AI-assistent", status: "Planerad modul" },
  { name: "Inställningar", status: "Aktiv arbetsyta" },
] as const;

const benefits = [
  {
    icon: CalendarCheck,
    title: "Fler bokningar utan mer administration",
    text: "Samla formulär, förfrågningar, bokningar och bekräftelser i ett tydligt arbetsflöde.",
  },
  {
    icon: MailCheck,
    title: "Snabbare uppföljning",
    text: "Få bokningsbekräftelser och kunduppgifter i ett tydligt flöde för enklare återkoppling.",
  },
  {
    icon: Users,
    title: "Kunddata på ett ställe",
    text: "Bygg en enkel CRM-grund för historik, kontaktuppgifter och uppföljning.",
  },
];

export default function HomePage() {
  return (
    <div className="overflow-hidden bg-[#f7f7f4]">
      <section className="relative">
        <div className="absolute inset-x-0 top-0 -z-0 h-[34rem] bg-[radial-gradient(circle_at_82%_15%,rgba(145,197,162,0.27),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f7f7f4_100%)]" />
        <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:px-8 lg:py-24">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-[#cfe0d3] bg-white/80 px-4 py-2 text-sm font-semibold text-[#17452f] shadow-sm">
            SaaS för svenska tjänsteföretag
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.06] tracking-[-0.04em] text-[#17201a] sm:text-5xl lg:text-6xl">
            Hantera leads, bokningar och kunddialog i ett smartare system.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#526057]">
            Proffera hjälper små företag i Sverige att ta emot förfrågningar, boka kunder och följa upp leads i samma portal.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/demo">{siteConfig.primaryCta}</ButtonLink>
            <ButtonLink href="/priser" variant="secondary">
              Se priser
            </ButtonLink>
          </div>
        </div>

        <div className="relative rounded-[1.75rem] border border-white/70 bg-white p-5 shadow-2xl shadow-[#17452f]/10 ring-1 ring-[#dfe5dd] sm:p-6">
          <div className="absolute right-7 top-0 h-1 w-20 rounded-b-full bg-[#1f6b49]" />
          <div className="flex items-center justify-between border-b border-[#dfe5dd] pb-5">
            <div>
              <p className="text-sm text-[#5b665f]">Kundportal</p>
              <p className="text-xl font-bold text-[#17201a]">Proffera arbetsyta</p>
            </div>
            <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Redo för demo</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {dashboardItems.map((item) => (
              <div key={item.name} className="rounded-xl border border-[#dfe5dd] bg-[#fbfbf8] px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-[#b6cfbd] hover:bg-white">
                <p className="font-semibold text-[#17201a]">{item.name}</p>
                <p className="mt-1 text-xs text-[#5b665f]">{item.status}</p>
              </div>
            ))}
          </div>
        </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="group rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-6 transition duration-200 hover:-translate-y-1 hover:border-[#b6cfbd] hover:bg-white hover:shadow-lg hover:shadow-[#17452f]/5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e7f1eb] text-[#17452f]"><Icon className="h-5 w-5" aria-hidden="true" /></div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#76847a]">0{index + 1}</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#17201a]">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#5b665f]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#17452f]">Tjänster</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#17201a]">Byggstenarna för ett modernt tjänsteföretag</h2>
          </div>
          <ButtonLink href="/tjanster" variant="secondary">Alla tjänster</ButtonLink>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {serviceCategories.slice(0, 10).map((category) => (
            <div key={category} className="flex items-center justify-between rounded-xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-[#dfe5dd] transition hover:-translate-y-0.5 hover:ring-[#b6cfbd]">
              <span className="text-sm font-medium text-[#17201a]">{category}</span>
              <ArrowRight className="h-4 w-4 text-[#17452f]" aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#e5ebe4] bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article key={plan.name} className="rounded-2xl border border-[#dfe5dd] bg-[#fcfdfb] p-6 transition hover:border-[#aac8b3] hover:shadow-lg hover:shadow-[#17452f]/5">
                <h2 className="text-2xl font-bold tracking-tight text-[#17201a]">{plan.name}</h2>
                <p className="mt-3 text-3xl font-bold text-[#17452f]">{plan.price}</p>
                <p className="mt-3 text-sm leading-6 text-[#5b665f]">{plan.description}</p>
                <ul className="mt-5 space-y-2 text-sm text-[#344139]">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#17452f]" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ConversionSections />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-[#102a1c] p-8 text-white md:p-11">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#2f875d]/30 blur-3xl" />
          <QrCode className="relative h-10 w-10" aria-hidden="true" />
          <h2 className="relative mt-5 text-3xl font-bold tracking-tight">Redo att se Proffera i praktiken?</h2>
          <p className="mt-3 max-w-2xl text-white/80">
            Boka en demo och se hur bokningsflöde, leadhantering och kundportal kan fungera för svenska tjänsteföretag.
          </p>
          <div className="relative mt-7">
            <ButtonLink href="/demo" variant="secondary">Boka demo</ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
