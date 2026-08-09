import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  FileText,
  House,
  MessageSquareText,
  Scissors,
  Sparkles,
  Wrench,
} from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import type { PublicLocale } from "@/lib/public-locale";

type Industry = {
  icon: LucideIcon;
  title: string;
  description: string;
  examples: string[];
  primaryFlow: string;
};

const copy = {
  sv: {
    eyebrow: "Branscher",
    title: "Samma kundflöde – anpassat för olika typer av tjänsteföretag",
    intro: "Proffera passar bäst när kunden behöver boka en tid, beskriva ett behov, få en offert eller kontakta företaget innan jobbet utförs. Tjänsterna kan ha olika nästa steg men fortsätter in i samma CRM och arbetsyta.",
    primary: "Starta gratis i 14 dagar",
    secondary: "Boka demo",
    industries: [
      {
        icon: House,
        title: "Städning och lokalvård",
        description: "För företag som kombinerar återkommande bokningar med jobb som behöver prisbedömas först.",
        examples: ["Hemstädning", "Flyttstädning", "Fönsterputs", "Kontorsstädning"],
        primaryFlow: "Bokning + offert",
      },
      {
        icon: Scissors,
        title: "Salong och bokningsbara tjänster",
        description: "För verksamheter där kunden främst väljer en tjänst, hittar en ledig tid och bokar direkt.",
        examples: ["Klippning", "Behandlingar", "Konsultation", "Återkommande tider"],
        primaryFlow: "Onlinebokning",
      },
      {
        icon: Wrench,
        title: "Hem- och teknisk service",
        description: "För servicebesök, installationer, underhåll och reparationer där omfattningen kan variera mellan uppdrag.",
        examples: ["Servicebesök", "Underhåll", "Installation", "Reparation"],
        primaryFlow: "Kontakt + offert",
      },
      {
        icon: MessageSquareText,
        title: "Lokala professionella tjänster",
        description: "För företag som behöver fånga förfrågningar, boka konsultationer och behålla kundhistoriken samlad.",
        examples: ["Konsultation", "Rådgivning", "Servicepaket", "Kunduppföljning"],
        primaryFlow: "Kontakt + bokning",
      },
    ] satisfies Industry[],
    modelEyebrow: "Det som varierar",
    modelTitle: "Varje tjänst väljer rätt väg in",
    modelLead: "Ett företag kan ha både enkla bokningsbara tjänster och större jobb som behöver offert. Proffera låter tjänsten styra nästa steg i stället för att tvinga hela verksamheten in i samma formulär.",
    models: [
      { icon: CalendarCheck2, title: "Boka", text: "Kunden väljer tjänst, datum och tillgänglig tid." },
      { icon: FileText, title: "Begär offert", text: "Kunden beskriver jobbet och förfrågan kopplas till rätt tjänst." },
      { icon: MessageSquareText, title: "Kontakta", text: "En kort kontaktförfrågan blir en kundmöjlighet som kan följas upp i CRM." },
    ],
    commonEyebrow: "Det som är gemensamt",
    commonTitle: "Efter första kontakten fortsätter arbetet i samma system",
    commonItems: ["Kund och historik i CRM", "Bokning eller offert kopplad till tjänsten", "Uppdrag och status", "Uppföljning, omdömen och analys"],
    finalTitle: "Se hur Proffera passar ditt sätt att arbeta",
    finalText: "Du kan börja själv med en 14-dagars provperiod eller boka demo om du vill gå igenom ett mer specifikt arbetsflöde.",
    finalPrimary: "Starta gratis",
    finalSecondary: "Boka demo",
  },
  en: {
    eyebrow: "Industries",
    title: "The same customer flow – adapted to different service businesses",
    intro: "Proffera works best when customers need to book a time, describe a need, request a quote or contact the business before work starts. Services can use different next steps while continuing into the same CRM and workspace.",
    primary: "Start free 14-day trial",
    secondary: "Book a demo",
    industries: [
      {
        icon: House,
        title: "Cleaning and facilities",
        description: "For businesses that combine recurring bookings with jobs that need pricing or scope assessment first.",
        examples: ["Home cleaning", "Move-out cleaning", "Window cleaning", "Office cleaning"],
        primaryFlow: "Booking + quote",
      },
      {
        icon: Scissors,
        title: "Salon and appointment services",
        description: "For businesses where customers mainly choose a service, find an available time and book directly.",
        examples: ["Haircuts", "Treatments", "Consultations", "Recurring appointments"],
        primaryFlow: "Online booking",
      },
      {
        icon: Wrench,
        title: "Home and technical service",
        description: "For service visits, installations, maintenance and repairs where scope can vary between jobs.",
        examples: ["Service visits", "Maintenance", "Installation", "Repairs"],
        primaryFlow: "Contact + quote",
      },
      {
        icon: MessageSquareText,
        title: "Local professional services",
        description: "For businesses that need to capture enquiries, book consultations and keep customer history together.",
        examples: ["Consultations", "Advisory", "Service packages", "Customer follow-up"],
        primaryFlow: "Contact + booking",
      },
    ] satisfies Industry[],
    modelEyebrow: "What varies",
    modelTitle: "Each service can use the right entry path",
    modelLead: "A business can have both simple bookable services and larger jobs that need a quote. Proffera lets the service control the next step instead of forcing the whole business into one form.",
    models: [
      { icon: CalendarCheck2, title: "Book", text: "The customer chooses a service, date and available time." },
      { icon: FileText, title: "Request a quote", text: "The customer describes the job and the request stays linked to the right service." },
      { icon: MessageSquareText, title: "Contact", text: "A short contact request becomes a customer opportunity that can be followed up in CRM." },
    ],
    commonEyebrow: "What stays the same",
    commonTitle: "After first contact, the work continues in one system",
    commonItems: ["Customer and history in CRM", "Booking or quote linked to the service", "Jobs and status", "Follow-up, reviews and analytics"],
    finalTitle: "See how Proffera fits the way you work",
    finalText: "Start on your own with a 14-day trial or book a demo if you want to walk through a more specific workflow.",
    finalPrimary: "Start free",
    finalSecondary: "Book a demo",
  },
} as const;

export function MarketingIndustries({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const signupHref = locale === "en" ? "/en/create-account" : "/skapa-konto";
  const demoHref = locale === "en" ? "/en/demo" : "/demo";

  return (
    <div className="overflow-hidden bg-[#f6f8f4]">
      <section className="border-b border-[#e1e7df] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#17452f]">{t.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.04em] text-[#17201a] sm:text-5xl">{t.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">{t.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><ButtonLink href={signupHref}>{t.primary}</ButtonLink><ButtonLink href={demoHref} variant="secondary">{t.secondary}</ButtonLink></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-2">{t.industries.map(({ icon: Icon, title, description, examples, primaryFlow }) => <article key={title} className="rounded-[1.8rem] border border-[#dfe5dd] bg-white p-6 shadow-sm sm:p-7"><div className="flex items-start justify-between gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf2ec] text-[#17452f]"><Icon className="h-6 w-6" /></span><span className="rounded-full bg-[#f1f5f1] px-3 py-1.5 text-xs font-black text-[#42604e]">{primaryFlow}</span></div><h2 className="mt-5 text-2xl font-black tracking-tight text-[#17201a]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#667168]">{description}</p><div className="mt-5 flex flex-wrap gap-2">{examples.map((example) => <span key={example} className="rounded-full border border-[#dde4dc] bg-[#fbfcfa] px-3 py-1.5 text-xs font-bold text-[#536158]">{example}</span>)}</div></article>)}</div>
      </section>

      <section className="border-y border-[#e1e7df] bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="max-w-3xl"><p className="text-sm font-black uppercase tracking-[0.14em] text-[#17452f]">{t.modelEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17201a]">{t.modelTitle}</h2><p className="mt-4 text-base leading-7 text-[#5b665f]">{t.modelLead}</p></div><div className="mt-8 grid gap-4 md:grid-cols-3">{t.models.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-[#dfe5dd] bg-[#f9fbf8] p-6"><Icon className="h-6 w-6 text-[#17452f]" /><h3 className="mt-5 text-xl font-black text-[#17201a]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#667168]">{text}</p></article>)}</div></div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-8 rounded-[2rem] bg-[#102a1c] p-8 text-white sm:p-10 lg:grid-cols-[.75fr_1.25fr] lg:items-center"><div><p className="text-sm font-black uppercase tracking-[0.14em] text-[#bfd1c4]">{t.commonEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-tight">{t.commonTitle}</h2></div><ul className="grid gap-3 sm:grid-cols-2">{t.commonItems.map((item) => <li key={item} className="flex items-start gap-3 rounded-2xl bg-white/[0.07] p-4 text-sm font-semibold text-white/85"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#e8c678]" />{item}</li>)}</ul></div></section>

      <section className="border-t border-[#e1e7df] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><div><div className="flex items-center gap-2 text-[#17452f]"><Sparkles className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[0.12em]">Proffera</span></div><h2 className="mt-3 text-3xl font-black tracking-tight text-[#17201a]">{t.finalTitle}</h2><p className="mt-3 max-w-2xl text-base leading-7 text-[#5b665f]">{t.finalText}</p></div><div className="flex flex-col gap-3 sm:flex-row"><ButtonLink href={signupHref}>{t.finalPrimary}</ButtonLink><ButtonLink href={demoHref} variant="secondary">{t.finalSecondary}</ButtonLink></div></div></section>
    </div>
  );
}
