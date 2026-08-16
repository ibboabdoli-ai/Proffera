import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  LayoutDashboard,
  MessageSquareText,
  Star,
  UserRound,
  Users,
} from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import type { PublicLocale } from "@/lib/public-locale";

type HomeCopy = {
  badge: string;
  title: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  micro: string[];
  workspaceExample: string;
  today: string;
  workspaceNav: string[];
  metrics: Array<{ label: string; value: string }>;
  activityTitle: string;
  activities: Array<{ time: string; text: string }>;
  lifecycleEyebrow: string;
  lifecycleTitle: string;
  lifecycleLead: string;
  lifecycle: Array<{ title: string; text: string }>;
  storefrontEyebrow: string;
  storefrontTitle: string;
  storefrontLead: string;
  services: Array<{ name: string; detail: string; price: string; action: string }>;
  storefrontNote: string;
  productEyebrow: string;
  productTitle: string;
  productLead: string;
  productGroups: Array<{ title: string; text: string; items: string[] }>;
  pricingEyebrow: string;
  pricingTitle: string;
  pricingLead: string;
  popular: string;
  plans: Array<{ name: string; price: string; description: string; features: string[]; cta: string; href: string }>;
  faqEyebrow: string;
  faqTitle: string;
  faqs: Array<{ question: string; answer: string }>;
  finalEyebrow: string;
  finalTitle: string;
  finalLead: string;
  finalPrimary: string;
  finalSecondary: string;
};

const copy: Record<PublicLocale, HomeCopy> = {
  sv: {
    badge: "Kundflödet för moderna tjänsteföretag",
    title: "Visa dina tjänster. Få in kunder. Hantera hela jobbet i Proffera.",
    intro: "Proffera samlar företagssida, bokningar, offertförfrågningar, CRM, uppdrag och uppföljning i ett tydligt arbetsflöde.",
    primaryCta: "Starta gratis i 14 dagar",
    secondaryCta: "Se hur det fungerar",
    micro: ["14 dagar gratis", "Ingen bindningstid", "Priser inkl. moms"],
    workspaceExample: "Exempel på arbetsyta",
    today: "Idag",
    workspaceNav: ["Översikt", "Bokningar", "Kunder", "Offerter"],
    metrics: [
      { label: "Bokningar", value: "6" },
      { label: "Nya leads", value: "3" },
      { label: "Offerter väntar", value: "2" },
      { label: "Att följa upp", value: "1" },
    ],
    activityTitle: "Senaste aktivitet",
    activities: [
      { time: "09:12", text: "Ny bokning · Hemstädning" },
      { time: "09:30", text: "Ny offertförfrågan · Flyttstädning" },
      { time: "10:05", text: "Offert accepterad" },
      { time: "11:20", text: "Uppdrag markerat som klart" },
    ],
    lifecycleEyebrow: "Ett sammanhängande arbetsflöde",
    lifecycleTitle: "Från synlig tjänst till slutfört jobb",
    lifecycleLead: "Kunden får en enkel väg framåt. Du behåller historik och nästa steg i samma system.",
    lifecycle: [
      { title: "Visa tjänster", text: "Publicera tjänster med rätt information och nästa steg." },
      { title: "Bokning eller offert", text: "Låt kunden boka direkt eller beskriva behovet." },
      { title: "CRM", text: "Samla kund och historik i samma arbetsyta." },
      { title: "Uppdrag", text: "Följ status, tider och arbetet som ska göras." },
      { title: "Uppföljning", text: "Avsluta jobbet och fortsätt med omdöme och återkoppling." },
    ],
    storefrontEyebrow: "Företagssida + tjänstekatalog",
    storefrontTitle: "Visa vad du säljer och låt kunden ta rätt nästa steg",
    storefrontLead: "En frisörtid kan bokas direkt. Ett större städ- eller servicejobb kan börja med offert. Proffera låter tjänsten styra kundresan.",
    services: [
      { name: "Hemstädning", detail: "Återkommande eller enstaka städning", price: "Från 499 kr", action: "Boka" },
      { name: "Flyttstädning", detail: "Pris efter bostadens storlek", price: "Pris på förfrågan", action: "Begär offert" },
      { name: "Kontorsstädning", detail: "Anpassad lösning för företag", price: "Anpassat upplägg", action: "Kontakta" },
    ],
    storefrontNote: "Samma tjänst följer vidare till bokning, offert, kundhistorik och uppdrag.",
    productEyebrow: "En arbetsyta bakom kundresan",
    productTitle: "Se vad som händer – och vad som behöver göras härnäst",
    productLead: "Proffera kopplar ihop kundens publika väg med företagets dagliga arbete så att du slipper parallella listor och separata system.",
    productGroups: [
      { title: "Få in kunder", text: "Gör vägen från intresse till kontakt kortare.", items: ["Företagssida", "Onlinebokning", "Offertförfrågningar", "Leads"] },
      { title: "Hantera kunder", text: "Behåll relation och historik på ett ställe.", items: ["Kund-CRM", "Kundhistorik", "Kundportal", "Bokningar"] },
      { title: "Driv jobbet", text: "Flytta arbetet framåt utan manuella sidolistor.", items: ["Offerter", "Uppdrag", "Status", "Kalender och personal"] },
      { title: "Följ upp", text: "Se vad som fungerar och bygg nästa kunddialog.", items: ["Verifierade omdömen", "Galleri", "Analys", "Påminnelser"] },
    ],
    pricingEyebrow: "Priser",
    pricingTitle: "Börja enkelt och väx när du behöver mer",
    pricingLead: "Alla planer bygger på samma kundflöde. Stripe Checkout visar alltid den slutliga betalningen.",
    popular: "Mest populär",
    plans: [
      { name: "Starter", price: "199 kr/mån", description: "För små företag som vill samla bokningar, leads och kunder.", features: ["Onlinebokning", "Leadhantering", "Kund-CRM", "Kundportal", "Påminnelser"], cta: "Starta gratis", href: "/skapa-konto?plan=starter" },
      { name: "Professional", price: "599 kr/mån", description: "För företag som vill visa tjänster online och driva fler delar av kundresan.", features: ["Allt i Starter", "Företagssida", "Offerter", "Galleri och verifierade omdömen", "Analys", "Flera medarbetare"], cta: "Starta gratis", href: "/skapa-konto?plan=professional" },
      { name: "Enterprise", price: "Kontakta oss", description: "För större eller mer avancerade upplägg med behov utöver standardflödet.", features: ["Allt i Professional", "Egen domän", "Avancerade arbetsflöden", "Anpassad uppsättning", "Prioriterad dialog"], cta: "Kontakta oss", href: "/kontakt" },
    ],
    faqEyebrow: "Vanliga frågor",
    faqTitle: "Det viktigaste innan du börjar",
    faqs: [
      { question: "Är Proffera en marknadsplats som Offerta?", answer: "Nej. Proffera är företagets eget system och publika kundyta. Varje företag visar sina egna tjänster och hanterar sina egna kunder, bokningar och offerter." },
      { question: "Kan kunden boka utan att skapa konto?", answer: "Ja. Det publika bokningsflödet är byggt för en enkel kundresa och kunden kan hantera sin bokning via självservice." },
      { question: "Kan olika tjänster ha olika nästa steg?", answer: "Ja. En publicerad tjänst kan leda till onlinebokning, offertförfrågan, kontakt eller både bokning och offert beroende på hur företaget arbetar." },
      { question: "Kan jag använda egen domän?", answer: "Egen domän finns för Enterprise-upplägg. Befintliga bokningsdomäner fortsätter vara bokningsfokuserade tills företaget väljer företagssidan som startsida." },
    ],
    finalEyebrow: "Redo att prova?",
    finalTitle: "Bygg ditt kundflöde i Proffera",
    finalLead: "Skapa arbetsytan, lägg in dina tjänster och börja med den del av flödet som ger mest värde först.",
    finalPrimary: "Starta gratis i 14 dagar",
    finalSecondary: "Boka demo",
  },
  en: {
    badge: "The customer flow for modern service businesses",
    title: "Show your services. Win customers. Manage the whole job in Proffera.",
    intro: "Proffera brings your business page, bookings, quote requests, CRM, jobs and follow-up into one clear workflow.",
    primaryCta: "Start free 14-day trial",
    secondaryCta: "See how it works",
    micro: ["14 days free", "No commitment", "Final price shown at checkout"],
    workspaceExample: "Example workspace",
    today: "Today",
    workspaceNav: ["Overview", "Bookings", "Customers", "Quotes"],
    metrics: [
      { label: "Bookings", value: "6" },
      { label: "New leads", value: "3" },
      { label: "Quotes waiting", value: "2" },
      { label: "To follow up", value: "1" },
    ],
    activityTitle: "Latest activity",
    activities: [
      { time: "09:12", text: "New booking · Home cleaning" },
      { time: "09:30", text: "New quote request · Move-out cleaning" },
      { time: "10:05", text: "Quote accepted" },
      { time: "11:20", text: "Job marked complete" },
    ],
    lifecycleEyebrow: "One connected workflow",
    lifecycleTitle: "From visible service to completed job",
    lifecycleLead: "Customers get a simple next step while you keep the history and operational follow-up in one system.",
    lifecycle: [
      { title: "Show services", text: "Publish services with the right information and next step." },
      { title: "Booking or quote", text: "Let customers book or describe what they need." },
      { title: "CRM", text: "Keep the customer and history in one workspace." },
      { title: "Jobs", text: "Track status, time and the work that needs to happen." },
      { title: "Follow up", text: "Complete the job and continue with reviews and follow-up." },
    ],
    storefrontEyebrow: "Business page + service catalogue",
    storefrontTitle: "Show what you sell and let customers take the right next step",
    storefrontLead: "A salon appointment can be booked directly. A larger cleaning or service job can start with a quote. Proffera lets each service control the customer path.",
    services: [
      { name: "Home cleaning", detail: "Recurring or one-off cleaning", price: "From SEK 499", action: "Book" },
      { name: "Move-out cleaning", detail: "Price based on home size", price: "Price on request", action: "Request quote" },
      { name: "Office cleaning", detail: "Tailored solution for businesses", price: "Tailored setup", action: "Contact" },
    ],
    storefrontNote: "The same service identity follows into booking, quotes, customer history and jobs.",
    productEyebrow: "One workspace behind the customer journey",
    productTitle: "See what is happening – and what needs to happen next",
    productLead: "Proffera connects the public customer journey with daily operations so you avoid parallel lists and separate systems.",
    productGroups: [
      { title: "Win customers", text: "Shorten the path from interest to a real customer action.", items: ["Business page", "Online booking", "Quote requests", "Leads"] },
      { title: "Manage customers", text: "Keep the relationship and history in one place.", items: ["Customer CRM", "Customer history", "Customer portal", "Bookings"] },
      { title: "Run the job", text: "Move work forward without manual side lists.", items: ["Quotes", "Jobs", "Status", "Calendar and staff"] },
      { title: "Follow up", text: "See what works and build the next customer conversation.", items: ["Verified reviews", "Gallery", "Analytics", "Reminders"] },
    ],
    pricingEyebrow: "Pricing",
    pricingTitle: "Start simple and grow when you need more",
    pricingLead: "Every plan is built around the same customer flow. Stripe Checkout always shows the final charge.",
    popular: "Most popular",
    plans: [
      { name: "Starter", price: "SEK 199/month", description: "For small businesses that want bookings, leads and customers in one place.", features: ["Online booking", "Lead management", "Customer CRM", "Customer portal", "Reminders"], cta: "Start free", href: "/en/create-account?plan=starter" },
      { name: "Professional", price: "SEK 599/month", description: "For businesses that want to show services online and run more of the customer journey.", features: ["Everything in Starter", "Business page", "Quotes", "Gallery and verified reviews", "Analytics", "Multiple staff"], cta: "Start free", href: "/en/create-account?plan=professional" },
      { name: "Enterprise", price: "Contact us", description: "For larger or more advanced setups with needs beyond the standard workflow.", features: ["Everything in Professional", "Custom domain", "Advanced workflows", "Tailored setup", "Priority dialogue"], cta: "Contact us", href: "/en/contact" },
    ],
    faqEyebrow: "Common questions",
    faqTitle: "What to know before you start",
    faqs: [
      { question: "Is Proffera a marketplace like Offerta?", answer: "No. Proffera gives each business its own operating system and public customer surface. Each business shows its own services and manages its own customers, bookings and quotes." },
      { question: "Can customers book without creating an account?", answer: "Yes. The public booking flow is designed for a simple customer journey, with self-service available for managing a booking." },
      { question: "Can different services use different next steps?", answer: "Yes. A published service can lead to online booking, a quote request, contact, or both booking and quote depending on how the business works." },
      { question: "Can I use my own domain?", answer: "Custom domains are available for Enterprise setups. Existing booking domains remain booking-first until the business explicitly switches the root to its business page." },
    ],
    finalEyebrow: "Ready to try it?",
    finalTitle: "Build your customer flow in Proffera",
    finalLead: "Create your workspace, add your services and start with the part of the flow that creates the most value first.",
    finalPrimary: "Start free 14-day trial",
    finalSecondary: "Book a demo",
  },
};

const lifecycleIcons: LucideIcon[] = [Globe2, CalendarCheck2, UserRound, ClipboardCheck, Star];
const groupIcons: LucideIcon[] = [Globe2, Users, LayoutDashboard, BarChart3];

function WorkspacePreview({ t }: { t: HomeCopy }) {
  return (
    <div className="relative overflow-hidden rounded-panel border border-line bg-surface shadow-lift">
      <div className="grid min-h-[31rem] grid-cols-[5.5rem_1fr] sm:grid-cols-[8rem_1fr]">
        <aside className="border-r border-line bg-brand-deep p-3 text-white sm:p-4" aria-label={t.workspaceExample}>
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-white/10 font-black">P</div>
          <div className="mt-8 grid gap-2" aria-hidden="true">
            {t.workspaceNav.map((item, index) => (
              <div key={item} className={`rounded-control px-2 py-2.5 text-[11px] font-bold sm:px-3 sm:text-xs ${index === 0 ? "bg-white text-brand-deep" : "text-white/65"}`}>
                <span className="hidden sm:inline">{item}</span>
                <span className="sm:hidden">{index + 1}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 bg-canvas">
          <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-4 sm:px-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-ink-muted">{t.workspaceExample}</p>
              <p className="mt-1 font-black text-ink">Proffera · {t.today}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-control bg-brand text-white"><LayoutDashboard className="h-4 w-4" /></span>
          </div>

          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3">
              {t.metrics.map((metric) => (
                <div key={metric.label} className="border-b border-line pb-3">
                  <p className="text-2xl font-black tracking-tight text-brand">{metric.value}</p>
                  <p className="mt-1 text-xs font-semibold text-ink-muted">{metric.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-7">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-ink-muted">{t.activityTitle}</p>
                <span className="h-2 w-2 rounded-full bg-brand" />
              </div>
              <div className="mt-4 grid gap-1">
                {t.activities.map((activity, index) => (
                  <div key={`${activity.time}-${activity.text}`} className="grid grid-cols-[2.7rem_1fr] gap-3 border-t border-line py-3 first:border-t-0">
                    <span className="text-xs font-bold text-ink-muted">{activity.time}</span>
                    <span className="text-sm font-semibold text-ink">{activity.text}</span>
                    {index === 0 ? <span className="col-start-2 -mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand">Live</span> : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MarketingHome({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const signupHref = locale === "en" ? "/en/create-account" : "/skapa-konto";
  const demoHref = locale === "en" ? "/en/demo" : "/demo";

  return (
    <div className="overflow-hidden bg-canvas">
      <section className="relative border-b border-line bg-surface">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(23,69,47,0.10),transparent_32%),radial-gradient(circle_at_15%_90%,rgba(232,198,120,0.10),transparent_28%)]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <p className="inline-flex rounded-full border border-line bg-brand-tint px-4 py-2 text-sm font-bold text-brand">{t.badge}</p>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.01] tracking-[-0.05em] text-ink sm:text-5xl lg:text-[4.25rem]">{t.title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">{t.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={signupHref}>{t.primaryCta}</ButtonLink>
              <ButtonLink href="#sa-fungerar" variant="secondary">{t.secondaryCta}</ButtonLink>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-ink-muted">
              {t.micro.map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand" />{item}</span>)}
            </div>
          </div>

          <WorkspacePreview t={t} />
        </div>
      </section>

      <section id="sa-fungerar" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-brand">{t.lifecycleEyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-ink sm:text-4xl">{t.lifecycleTitle}</h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-ink-muted lg:justify-self-end">{t.lifecycleLead}</p>
        </div>

        <div className="mt-10 overflow-hidden rounded-panel bg-brand-deep text-white shadow-card">
          <div className="grid lg:grid-cols-5">
            {t.lifecycle.map((step, index) => {
              const Icon = lifecycleIcons[index];
              return (
                <article key={step.title} className="relative border-b border-white/10 p-6 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-control bg-white/10"><Icon className="h-5 w-5" /></span>
                    <span className="text-xs font-black text-white/35">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 font-black">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{step.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.14em] text-brand">{t.storefrontEyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-ink sm:text-4xl">{t.storefrontTitle}</h2>
            <p className="mt-4 text-base leading-7 text-ink-muted">{t.storefrontLead}</p>
            <p className="mt-6 border-l-2 border-brand pl-4 text-sm font-semibold leading-6 text-brand">{t.storefrontNote}</p>
          </div>

          <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-card">
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-control bg-brand font-black text-white">A</span>
              <div><p className="font-black text-ink">ABC Service</p><p className="text-xs text-ink-muted">{locale === "en" ? "Our services" : "Våra tjänster"}</p></div>
            </div>
            <div>
              {t.services.map((service) => (
                <article key={service.name} className="grid gap-4 border-b border-line px-5 py-5 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <h3 className="font-black text-ink">{service.name}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{service.detail}</p>
                    <p className="mt-2 text-sm font-black text-brand">{service.price}</p>
                  </div>
                  <span className="inline-flex min-h-10 items-center justify-center rounded-control border border-brand px-4 text-sm font-black text-brand">
                    {service.action}<ArrowRight className="ml-2 h-4 w-4" />
                  </span>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-brand">{t.productEyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-ink sm:text-4xl">{t.productTitle}</h2>
            <p className="mt-4 text-base leading-7 text-ink-muted">{t.productLead}</p>
          </div>

          <div className="divide-y divide-line border-y border-line">
            {t.productGroups.map((group, index) => {
              const Icon = groupIcons[index];
              return (
                <article key={group.title} className="grid gap-4 py-7 sm:grid-cols-[3rem_0.7fr_1.3fr] sm:items-start">
                  <span className="flex h-11 w-11 items-center justify-center rounded-control bg-brand-soft text-brand"><Icon className="h-5 w-5" /></span>
                  <div><h3 className="text-xl font-black text-ink">{group.title}</h3><p className="mt-2 text-sm leading-6 text-ink-muted">{group.text}</p></div>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {group.items.map((item) => <li key={item} className="flex items-center gap-2 text-sm font-semibold text-ink"><CheckCircle2 className="h-4 w-4 shrink-0 text-brand" />{item}</li>)}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-surface py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.14em] text-brand">{t.pricingEyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-ink sm:text-4xl">{t.pricingTitle}</h2>
            <p className="mt-4 text-base leading-7 text-ink-muted">{t.pricingLead}</p>
          </div>

          <div className="mt-10 grid gap-0 overflow-hidden rounded-panel border border-line lg:grid-cols-3">
            {t.plans.map((plan) => {
              const popular = plan.name === "Professional";
              return (
                <article key={plan.name} className={`relative flex flex-col border-b border-line p-6 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0 ${popular ? "bg-brand-tint" : "bg-surface"}`}>
                  {popular ? <span className="mb-4 w-fit rounded-full bg-brand px-3 py-1 text-xs font-black text-white">{t.popular}</span> : <span className="mb-4 h-6" aria-hidden="true" />}
                  <h3 className="text-2xl font-black text-ink">{plan.name}</h3>
                  <p className="mt-3 text-3xl font-black tracking-tight text-brand">{plan.price}</p>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-ink-muted">{plan.description}</p>
                  <ul className="mt-6 grid gap-2.5">
                    {plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm font-semibold text-ink"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{feature}</li>)}
                  </ul>
                  <div className="mt-auto pt-7"><ButtonLink href={plan.href} variant={popular ? "primary" : "secondary"} className="w-full">{plan.cta}</ButtonLink></div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div><p className="text-sm font-black uppercase tracking-[0.14em] text-brand">{t.faqEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-ink">{t.faqTitle}</h2></div>
          <div className="border-y border-line">
            {t.faqs.map((item, index) => (
              <details key={item.question} className="group border-b border-line py-5 last:border-b-0" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-black text-ink">
                  {item.question}
                  <span className="text-xl font-medium text-brand transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 max-w-2xl pr-10 text-sm leading-7 text-ink-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-panel bg-brand-deep p-8 text-white sm:p-10 lg:p-12">
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-brand/40 blur-3xl" aria-hidden="true" />
          <MessageSquareText className="relative h-9 w-9 text-accent-soft" />
          <p className="relative mt-5 text-sm font-black uppercase tracking-[0.14em] text-white/55">{t.finalEyebrow}</p>
          <h2 className="relative mt-2 max-w-3xl text-3xl font-black tracking-[-0.035em] sm:text-4xl">{t.finalTitle}</h2>
          <p className="relative mt-4 max-w-2xl text-base leading-7 text-white/70">{t.finalLead}</p>
          <div className="relative mt-7 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={signupHref}>{t.finalPrimary}</ButtonLink>
            <ButtonLink href={demoHref} variant="secondary">{t.finalSecondary}</ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
