import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Globe2,
  Images,
  MessageSquareText,
  Star,
  UserRound,
  Users,
} from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import type { PublicLocale } from "@/lib/public-locale";

type FeatureGroup = {
  icon: LucideIcon;
  title: string;
  description: string;
  items: Array<{ title: string; text: string }>;
};

const copy = {
  sv: {
    eyebrow: "Funktioner",
    title: "Ett kundflöde – från första klick till slutfört jobb",
    intro: "Proffera kopplar ihop den publika kundresan med det dagliga arbetet. Kunden kan hitta en tjänst, boka eller begära offert och du fortsätter i CRM, uppdrag och uppföljning utan att börja om i ett nytt system.",
    primary: "Starta gratis i 14 dagar",
    secondary: "Se priser",
    flow: ["Tjänst", "Bokning / offert", "Kund", "Uppdrag", "Uppföljning"],
    groups: [
      {
        icon: Globe2,
        title: "Visa tjänster och få in kunder",
        description: "Gör det tydligt vad du erbjuder och ge varje tjänst rätt nästa steg.",
        items: [
          { title: "Företagssida", text: "Publicera företagets tjänster, kontaktvägar, galleri och omdömen på en samlad kundyta." },
          { title: "Onlinebokning", text: "Låt kunden välja tjänst, datum och ledig tid direkt online." },
          { title: "Offertförfrågningar", text: "För tjänster som behöver bedömas först kan kunden beskriva behovet och skicka en strukturerad förfrågan." },
          { title: "Leadhantering", text: "Kontaktförfrågningar och nya kundmöjligheter samlas i arbetsytan för uppföljning." },
        ],
      },
      {
        icon: UserRound,
        title: "Samla kunden och historiken",
        description: "Behåll kundrelationen i samma arbetsyta även när kontakten börjar i olika flöden.",
        items: [
          { title: "Kund-CRM", text: "Kunduppgifter, historik och relevanta aktiviteter på ett ställe." },
          { title: "Kundportal", text: "Kunden kan hantera sina bokningar via självservice utan onödig administration." },
          { title: "Bokningshistorik", text: "Se vad kunden har bokat och behåll kopplingen mellan kund, tjänst och jobb." },
          { title: "Dublettskydd", text: "Återkommande bokningar med samma e-post kan återanvända befintlig kund i stället för att skapa onödiga dubbletter." },
        ],
      },
      {
        icon: ClipboardCheck,
        title: "Driv jobbet framåt",
        description: "Flytta kunden från förfrågan eller bokning till ett faktiskt uppdrag med tydlig status.",
        items: [
          { title: "Offerter", text: "Skapa och följ offertflödet från inkommande behov till accepterad offert." },
          { title: "Uppdrag", text: "Bokningar och accepterade offerter kan fortsätta som servicejobb utan att tappa kundkopplingen." },
          { title: "Kalender och personal", text: "Planera bokningsbara tider och se det operativa arbetet i samma portal." },
          { title: "Status och historik", text: "Reschedule, avbokning och jobbstatus hålls ihop med kundens historik." },
        ],
      },
      {
        icon: Star,
        title: "Följ upp och se vad som fungerar",
        description: "Avsluta inte kundresan när jobbet är klart. Samla social proof och förstå vilka tjänster som engagerar.",
        items: [
          { title: "Verifierade omdömen", text: "Efter ett slutfört jobb kan kunden få en verifierad väg att lämna omdöme." },
          { title: "Galleri", text: "Visa bilder och tidigare arbete på den publika företagssidan." },
          { title: "Analys", text: "Se besök, tjänstevisningar och klick vidare till bokning, offert eller kontakt." },
          { title: "Påminnelser", text: "Minska manuella uppföljningar kring bokningar med automatiserade påminnelseflöden." },
        ],
      },
    ] satisfies FeatureGroup[],
    examplesTitle: "Olika tjänster kan ha olika nästa steg",
    examplesLead: "Proffera tvingar inte alla företag in i samma kundresa. Varje tjänst kan leda till den konvertering som passar arbetet.",
    examples: [
      { icon: CalendarCheck2, title: "Boka online", text: "För tidsbaserade tjänster som klippning, konsultation eller återkommande service." },
      { icon: FileText, title: "Begär offert", text: "För jobb där pris eller omfattning behöver bedömas innan kunden kan beställa." },
      { icon: MessageSquareText, title: "Kontakta", text: "För tjänster där företaget först behöver en kort kunddialog." },
    ],
    proofTitle: "Samma service-ID genom kundresan",
    proofText: "Tjänsten som kunden såg offentligt följer med in i bokning eller offert och kan sedan knytas vidare till kundhistorik och uppdrag. Det minskar risken för parallella listor och data som driver isär.",
    finalTitle: "Börja med kundflödet du behöver idag",
    finalText: "Skapa en arbetsyta, välj plan och prova Proffera gratis i 14 dagar.",
    finalPrimary: "Starta gratis",
    finalSecondary: "Boka demo",
  },
  en: {
    eyebrow: "Features",
    title: "One customer flow – from first click to completed job",
    intro: "Proffera connects the public customer journey with daily operations. A customer can discover a service, book or request a quote, and you continue in CRM, jobs and follow-up without starting over in another system.",
    primary: "Start free 14-day trial",
    secondary: "See pricing",
    flow: ["Service", "Booking / quote", "Customer", "Job", "Follow-up"],
    groups: [
      {
        icon: Globe2,
        title: "Show services and win customers",
        description: "Make your offer clear and give each service the right next step.",
        items: [
          { title: "Business page", text: "Publish services, contact options, gallery and reviews in one public customer surface." },
          { title: "Online booking", text: "Let customers choose a service, date and available time online." },
          { title: "Quote requests", text: "For services that need an assessment first, customers can describe the need and send a structured request." },
          { title: "Lead management", text: "Contact requests and new customer opportunities are collected in the workspace for follow-up." },
        ],
      },
      {
        icon: UserRound,
        title: "Keep the customer and history together",
        description: "Maintain the customer relationship in one workspace even when the conversation starts in different flows.",
        items: [
          { title: "Customer CRM", text: "Customer details, history and relevant activity in one place." },
          { title: "Customer portal", text: "Customers can manage bookings through self-service and reduce administration." },
          { title: "Booking history", text: "See what a customer has booked and keep the link between customer, service and job." },
          { title: "Duplicate protection", text: "Repeat bookings using the same email can reuse the existing customer instead of creating unnecessary duplicates." },
        ],
      },
      {
        icon: ClipboardCheck,
        title: "Move the job forward",
        description: "Turn a request or booking into an actual job with clear status and ownership.",
        items: [
          { title: "Quotes", text: "Create and follow the quote flow from incoming need to accepted offer." },
          { title: "Jobs", text: "Bookings and accepted quotes can continue as service jobs without losing the customer link." },
          { title: "Calendar and staff", text: "Plan bookable time and operational work from the same portal." },
          { title: "Status and history", text: "Rescheduling, cancellation and job status stay connected to customer history." },
        ],
      },
      {
        icon: Star,
        title: "Follow up and see what works",
        description: "The customer journey does not need to end when the job is complete. Build social proof and understand which services engage customers.",
        items: [
          { title: "Verified reviews", text: "After a completed job, customers can receive a verified path to leave a review." },
          { title: "Gallery", text: "Show images and previous work on the public business page." },
          { title: "Analytics", text: "See visits, service views and clicks into booking, quote or contact flows." },
          { title: "Reminders", text: "Reduce manual booking follow-up with automated reminder flows." },
        ],
      },
    ] satisfies FeatureGroup[],
    examplesTitle: "Different services can use different next steps",
    examplesLead: "Proffera does not force every business into the same customer journey. Each service can use the conversion that matches the work.",
    examples: [
      { icon: CalendarCheck2, title: "Book online", text: "For time-based services such as appointments, consultations or recurring service." },
      { icon: FileText, title: "Request a quote", text: "For jobs where price or scope needs to be assessed before the customer can order." },
      { icon: MessageSquareText, title: "Contact", text: "For services where the business first needs a short customer conversation." },
    ],
    proofTitle: "The same service ID through the customer journey",
    proofText: "The service a customer sees publicly follows into booking or quote and can continue into customer history and jobs. That reduces parallel lists and drifting data.",
    finalTitle: "Start with the customer flow you need today",
    finalText: "Create a workspace, choose a plan and try Proffera free for 14 days.",
    finalPrimary: "Start free",
    finalSecondary: "Book a demo",
  },
} as const;

export function MarketingFeatures({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const signupHref = locale === "en" ? "/en/create-account" : "/skapa-konto";
  const pricingHref = locale === "en" ? "/en/pricing" : "/priser";
  const demoHref = locale === "en" ? "/en/demo" : "/demo";

  return (
    <div className="overflow-hidden bg-[#f6f8f4]">
      <section className="border-b border-[#e1e7df] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#17452f]">{t.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.04em] text-[#17201a] sm:text-5xl">{t.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">{t.intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><ButtonLink href={signupHref}>{t.primary}</ButtonLink><ButtonLink href={pricingHref} variant="secondary">{t.secondary}</ButtonLink></div>
          <div className="mt-10 flex flex-wrap items-center gap-2">{t.flow.map((item, index) => <div key={item} className="flex items-center gap-2"><span className="rounded-full border border-[#cfdcd1] bg-[#f8fbf8] px-4 py-2 text-sm font-black text-[#28523b]">{item}</span>{index < t.flow.length - 1 ? <ArrowRight className="h-4 w-4 text-[#93a298]" /> : null}</div>)}</div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">{t.groups.map(({ icon: Icon, title, description, items }) => <article key={title} className="rounded-[1.8rem] border border-[#dfe5dd] bg-white p-6 shadow-sm sm:p-7"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf2ec] text-[#17452f]"><Icon className="h-6 w-6" /></div><h2 className="mt-5 text-2xl font-black tracking-tight text-[#17201a]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#667168]">{description}</p><div className="mt-6 grid gap-3">{items.map((item) => <div key={item.title} className="rounded-2xl bg-[#f7f9f6] p-4"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2f7b53]" /><div><h3 className="font-black text-[#17201a]">{item.title}</h3><p className="mt-1 text-sm leading-6 text-[#667168]">{item.text}</p></div></div></div>)}</div></article>)}</div>
      </section>

      <section className="border-y border-[#e1e7df] bg-white py-20"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="max-w-3xl"><h2 className="text-3xl font-black tracking-[-0.03em] text-[#17201a]">{t.examplesTitle}</h2><p className="mt-4 text-base leading-7 text-[#5b665f]">{t.examplesLead}</p></div><div className="mt-8 grid gap-4 md:grid-cols-3">{t.examples.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-[#dfe5dd] bg-[#fbfcfa] p-6"><Icon className="h-6 w-6 text-[#17452f]" /><h3 className="mt-5 text-xl font-black text-[#17201a]">{title}</h3><p className="mt-2 text-sm leading-6 text-[#667168]">{text}</p></article>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-6 rounded-[2rem] bg-[#102a1c] p-8 text-white sm:p-10 lg:grid-cols-[.75fr_1.25fr] lg:items-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-[#e8c678]"><Users className="h-7 w-7" /></div><div><h2 className="text-3xl font-black tracking-tight">{t.proofTitle}</h2><p className="mt-3 max-w-3xl text-base leading-7 text-white/75">{t.proofText}</p></div></div></section>

      <section className="border-t border-[#e1e7df] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"><div><h2 className="text-3xl font-black tracking-tight text-[#17201a]">{t.finalTitle}</h2><p className="mt-3 text-base text-[#5b665f]">{t.finalText}</p></div><div className="flex flex-col gap-3 sm:flex-row"><ButtonLink href={signupHref}>{t.finalPrimary}</ButtonLink><ButtonLink href={demoHref} variant="secondary">{t.finalSecondary}</ButtonLink></div></div></section>
    </div>
  );
}
