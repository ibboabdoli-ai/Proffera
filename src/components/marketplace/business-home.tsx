import Link from "next/link";
import { ArrowRight, CalendarCheck2, CheckCircle2, ClipboardList, LayoutDashboard, Users } from "lucide-react";

import type { PublicLocale } from "@/lib/public-locale";

type BusinessHomeCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  primary: string;
  secondary: string;
  marketplace: string;
  benefitsTitle: string;
  benefitsLead: string;
  benefits: Array<{ title: string; text: string }>;
  flowTitle: string;
  flow: string[];
};

const copy: Record<PublicLocale, BusinessHomeCopy> = {
  sv: {
    eyebrow: "Proffera för företag",
    title: "Få kunder från marknadsplatsen. Hantera resten i din arbetsyta.",
    lead: "Publicera tjänster, låt kunden boka eller begära offert och fortsätt sedan med CRM, uppdrag och uppföljning i samma system.",
    primary: "Starta gratis i 14 dagar",
    secondary: "Se priser",
    marketplace: "Till marknadsplatsen",
    benefitsTitle: "Ett kundflöde i stället för separata verktyg",
    benefitsLead: "Kundens nästa steg kopplas till företagets operativa arbete från början.",
    benefits: [
      { title: "Bokning", text: "Publicera bokningsbara tjänster med pris, längd och tillgänglighet." },
      { title: "Offerter & leads", text: "Ta emot jobb som behöver bedömas eller prissättas innan kunden bestämmer sig." },
      { title: "Kund-CRM", text: "Behåll kunden, historiken och nästa steg i samma arbetsyta." },
      { title: "Uppdrag", text: "Följ arbetet från accepterad kund till genomfört jobb och uppföljning." },
    ],
    flowTitle: "Marketplace → tjänst → kund → jobb",
    flow: ["Bli hittad", "Boka eller få offertförfrågan", "Hantera kunden", "Slutför jobbet"],
  },
  en: {
    eyebrow: "Proffera for businesses",
    title: "Win customers from the marketplace. Manage the rest in your workspace.",
    lead: "Publish services, let customers book or request a quote, then continue with CRM, jobs and follow-up in the same system.",
    primary: "Start free 14-day trial",
    secondary: "See pricing",
    marketplace: "Go to marketplace",
    benefitsTitle: "One customer flow instead of separate tools",
    benefitsLead: "The customer's next action connects to the business workflow from the beginning.",
    benefits: [
      { title: "Booking", text: "Publish bookable services with price, duration and availability." },
      { title: "Quotes & leads", text: "Receive work that needs assessment or pricing before the customer decides." },
      { title: "Customer CRM", text: "Keep the customer, history and next step in the same workspace." },
      { title: "Jobs", text: "Track work from accepted customer to completed job and follow-up." },
    ],
    flowTitle: "Marketplace → service → customer → job",
    flow: ["Get discovered", "Receive a booking or quote request", "Manage the customer", "Complete the job"],
  },
};

const icons = [CalendarCheck2, ClipboardList, Users, LayoutDashboard] as const;

export function BusinessHome({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const signupHref = locale === "en" ? "/en/create-account" : "/skapa-konto";
  const pricingHref = locale === "en" ? "/en/pricing" : "/priser";
  const marketplaceHref = locale === "en" ? "/en" : "/";

  return (
    <div className="bg-canvas text-ink">
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-brand-soft blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:grid lg:grid-cols-[1fr_0.7fr] lg:items-center lg:gap-12 lg:px-8 lg:py-24">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-brand">{t.eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.01] tracking-[-0.05em] sm:text-5xl lg:text-6xl">{t.title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">{t.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={signupHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-brand px-6 text-sm font-black text-white transition hover:bg-brand-strong">
                {t.primary}<ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={pricingHref} className="inline-flex min-h-12 items-center justify-center rounded-control border border-line bg-surface px-6 text-sm font-black text-brand transition hover:bg-brand-soft">
                {t.secondary}
              </Link>
            </div>
            <Link href={marketplaceHref} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-brand hover:underline">
              ← {t.marketplace}
            </Link>
          </div>

          <div className="mt-10 rounded-panel bg-brand-deep p-6 text-white shadow-lift lg:mt-0">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-white/55">{t.flowTitle}</p>
            <div className="mt-5 grid gap-3">
              {t.flow.map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-control bg-white/8 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-brand-deep">{index + 1}</span>
                  <span className="font-bold">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-black tracking-[-0.035em] sm:text-4xl">{t.benefitsTitle}</h2>
          <p className="mt-4 text-base leading-7 text-muted">{t.benefitsLead}</p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {t.benefits.map((benefit, index) => {
            const Icon = icons[index];
            return (
              <article key={benefit.title} className="rounded-panel border border-line bg-surface p-6 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-control bg-brand-soft text-brand"><Icon className="h-5 w-5" /></span>
                <h3 className="mt-5 text-lg font-black">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{benefit.text}</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-brand"><CheckCircle2 className="h-4 w-4" />Proffera</div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
