import { ArrowRight, Bot, CalendarCheck, CheckCircle2, QrCode, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { ConversionSections } from "@/components/marketing/conversion-sections";
import { pricingPlans, serviceCategories, siteConfig } from "@/lib/site";

const dashboardItems = ["Leads", "Kunder", "Bokningar", "Analys", "AI Assistant", "Inställningar"] as const;

const benefits = [
  {
    icon: CalendarCheck,
    title: "Fler bokningar utan mer administration",
    text: "Samla formulär, förfrågningar, bokningar och bekräftelser i ett tydligt arbetsflöde.",
  },
  {
    icon: Bot,
    title: "AI som svarar snabbare",
    text: "Ge besökare svar direkt och fånga upp leads även när företaget är stängt.",
  },
  {
    icon: Users,
    title: "Kunddata på ett ställe",
    text: "Bygg en enkel CRM-grund för historik, kontaktuppgifter och uppföljning.",
  },
];

export default function HomePage() {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
        <div>
          <p className="mb-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#17452f] shadow-sm">
            SaaS för svenska tjänsteföretag
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl lg:text-6xl">
            Hantera leads, bokningar och kunddialog i ett smartare system.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5b665f]">
            Proffera hjälper små företag i Sverige att ta emot förfrågningar, boka kunder, följa upp leads och använda AI för snabbare kommunikation.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/demo">{siteConfig.primaryCta}</ButtonLink>
            <ButtonLink href="/priser" variant="secondary">
              Se priser
            </ButtonLink>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-xl shadow-black/5 ring-1 ring-[#dfe5dd]">
          <div className="flex items-center justify-between border-b border-[#dfe5dd] pb-4">
            <div>
              <p className="text-sm text-[#5b665f]">Admin dashboard</p>
              <p className="text-xl font-bold text-[#17201a]">Proffera Workspace</p>
            </div>
            <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Live MVP</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {dashboardItems.map((item) => (
              <div key={item} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] px-4 py-3">
                <p className="font-semibold text-[#17201a]">{item}</p>
                <p className="mt-1 text-xs text-[#5b665f]">SaaS-modul</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-6">
                <Icon className="h-8 w-8 text-[#17452f]" aria-hidden="true" />
                <h2 className="mt-5 text-xl font-semibold text-[#17201a]">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#5b665f]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Tjänster</p>
            <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Byggstenarna för ett modernt tjänsteföretag</h2>
          </div>
          <ButtonLink href="/tjanster" variant="secondary">Alla tjänster</ButtonLink>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {serviceCategories.slice(0, 10).map((category) => (
            <div key={category} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-[#dfe5dd]">
              <span className="text-sm font-medium text-[#17201a]">{category}</span>
              <ArrowRight className="h-4 w-4 text-[#17452f]" aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <article key={plan.name} className="rounded-3xl border border-[#dfe5dd] p-6">
                <h2 className="text-2xl font-bold text-[#17201a]">{plan.name}</h2>
                <p className="mt-2 text-3xl font-bold text-[#17452f]">{plan.price}</p>
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
        <div className="rounded-3xl bg-[#17452f] p-8 text-white md:p-10">
          <QrCode className="h-10 w-10" aria-hidden="true" />
          <h2 className="mt-5 text-3xl font-bold">Redo att visa Proffera för första kunder?</h2>
          <p className="mt-3 max-w-2xl text-white/80">
            Boka en demo och se hur bokningsflöde, leadhantering, AI-chatt och adminöversikt kan fungera för svenska tjänsteföretag.
          </p>
          <div className="mt-6">
            <ButtonLink href="/demo" variant="secondary">Se demo</ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
