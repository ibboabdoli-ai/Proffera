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
    micro: ["14 dagar gratis", "Ingen bindningstid", "Kom igång på några minuter"],
    workspaceExample: "Exempel på arbetsyta",
    today: "Idag",
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
      { time: "11:21", text: "Omdömesförfrågan skickad" },
    ],
    lifecycleEyebrow: "Ett sammanhängande arbetsflöde",
    lifecycleTitle: "Från synlig tjänst till slutfört jobb",
    lifecycleLead: "Kunden får en enkel väg framåt. Du behåller hela historiken och nästa steg i samma system.",
    lifecycle: [
      { title: "Visa tjänster", text: "Publicera tjänster på din företagssida med pris, information och rätt nästa steg." },
      { title: "Bokning eller offert", text: "Låt kunden boka direkt eller beskriva behovet och begära offert." },
      { title: "CRM", text: "Kund och historik samlas automatiskt så att inget tappas mellan kanaler." },
      { title: "Uppdrag", text: "Följ status, tider och det som ska göras från samma arbetsyta." },
      { title: "Uppföljning", text: "Avsluta jobbet och fortsätt med omdöme, återkoppling och nästa kunddialog." },
    ],
    storefrontEyebrow: "Företagssida + tjänstekatalog",
    storefrontTitle: "Visa vad du säljer och låt kunden ta nästa steg direkt",
    storefrontLead: "Olika tjänster behöver olika vägar. En frisörtid kan bokas direkt medan ett större städ- eller servicejobb först behöver en offertförfrågan.",
    services: [
      { name: "Hemstädning", detail: "Återkommande eller enstaka städning", price: "Från 499 kr", action: "Boka" },
      { name: "Flyttstädning", detail: "Pris efter bostadens storlek", price: "Pris på förfrågan", action: "Begär offert" },
      { name: "Kontorsstädning", detail: "Anpassad lösning för företag", price: "Anpassat upplägg", action: "Kontakta" },
    ],
    storefrontNote: "Samma tjänst följer sedan med in i bokning, offert, kundhistorik och uppdrag.",
    productEyebrow: "En arbetsyta bakom kundresan",
    productTitle: "Du ser vad som händer – och vad som behöver göras härnäst",
    productLead: "Proffera kopplar ihop kundens publika väg med företagets dagliga arbete. Du slipper hålla samma information i separata formulär, listor och system.",
    productGroups: [
      { title: "Få in kunder", text: "Gör vägen från intresse till kontakt kortare.", items: ["Företagssida", "Onlinebokning", "Offertförfrågningar", "Leads"] },
      { title: "Hantera kunder", text: "Behåll relation och historik på ett ställe.", items: ["Kund-CRM", "Kundhistorik", "Kundportal", "Bokningar"] },
      { title: "Driv jobbet", text: "Flytta arbetet framåt utan manuella sidolistor.", items: ["Offerter", "Uppdrag", "Status", "Kalender och personal"] },
      { title: "Följ upp", text: "Se vad som fungerar och bygg nästa affär.", items: ["Verifierade omdömen", "Galleri", "Analys", "Påminnelser"] },
    ],
    pricingEyebrow: "Priser",
    pricingTitle: "Börja enkelt och väx när du behöver mer",
    pricingLead: "Alla planer är byggda runt samma kundflöde. Professional öppnar de publika säljytorna och fler verktyg för ett växande team.",
    popular: "Mest populär",
    plans: [
      { name: "Starter", price: "Från 299 kr/mån", description: "För små företag som vill samla bokningar, leads och kunder.", features: ["Onlinebokning", "Leadhantering", "Kund-CRM", "Kundportal", "Påminnelser"], cta: "Starta gratis", href: "/skapa-konto?plan=starter" },
      { name: "Professional", price: "Från 699 kr/mån", description: "För företag som vill visa tjänster online och driva fler delar av kundresan i Proffera.", features: ["Allt i Starter", "Företagssida", "Offerter", "Galleri och verifierade omdömen", "Analys", "Flera medarbetare"], cta: "Starta gratis", href: "/skapa-konto?plan=professional" },
      { name: "Business", price: "Anpassat pris", description: "För större eller mer avancerade upplägg med behov utöver standardflödet.", features: ["Allt i Professional", "Egen domän", "Avancerade arbetsflöden", "Anpassad uppsättning", "Prioriterad dialog"], cta: "Kontakta oss", href: "/kontakt" },
    ],
    faqEyebrow: "Vanliga frågor",
    faqTitle: "Det viktigaste innan du börjar",
    faqs: [
      { question: "Är Proffera en marknadsplats som Offerta?", answer: "Nej. Proffera är i dag företagets eget system och publika kundyta. Varje företag visar sina egna tjänster och hanterar sina egna kunder, bokningar och offerter." },
      { question: "Kan kunden boka utan att skapa konto?", answer: "Ja. Företagets publika bokningsflöde är byggt för en enkel kundresa och kunden kan även hantera sin bokning via självservice." },
      { question: "Kan olika tjänster ha olika nästa steg?", answer: "Ja. En publicerad tjänst kan leda till onlinebokning, offertförfrågan, kontakt eller både bokning och offert beroende på hur företaget arbetar." },
      { question: "Kan jag använda egen domän?", answer: "Egen domän finns för Business-upplägg. Befintliga bokningsdomäner fortsätter vara bokningsfokuserade tills företaget själv väljer företagssidan som startsida." },
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
    micro: ["14 days free", "No commitment", "Get started in minutes"],
    workspaceExample: "Example workspace",
    today: "Today",
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
      { time: "11:21", text: "Review request sent" },
    ],
    lifecycleEyebrow: "One connected workflow",
    lifecycleTitle: "From visible service to completed job",
    lifecycleLead: "Customers get a simple next step while you keep the history and operational follow-up in the same system.",
    lifecycle: [
      { title: "Show services", text: "Publish services on your business page with pricing, information and the right next step." },
      { title: "Booking or quote", text: "Let customers book directly or describe the need and request a quote." },
      { title: "CRM", text: "Customer details and history stay together so nothing gets lost between channels." },
      { title: "Jobs", text: "Track status, time and what needs to happen from the same workspace." },
      { title: "Follow up", text: "Complete the job and continue with reviews, follow-up and the next customer conversation." },
    ],
    storefrontEyebrow: "Business page + service catalogue",
    storefrontTitle: "Show what you sell and let customers take the right next step",
    storefrontLead: "Different services need different paths. A salon appointment can be booked directly, while a larger cleaning or service job may need a quote first.",
    services: [
      { name: "Home cleaning", detail: "Recurring or one-off cleaning", price: "From SEK 499", action: "Book" },
      { name: "Move-out cleaning", detail: "Price based on home size", price: "Price on request", action: "Request quote" },
      { name: "Office cleaning", detail: "Tailored solution for businesses", price: "Tailored setup", action: "Contact" },
    ],
    storefrontNote: "The same service identity then follows into booking, quotes, customer history and jobs.",
    productEyebrow: "One workspace behind the customer journey",
    productTitle: "See what is happening – and what needs to happen next",
    productLead: "Proffera connects the public customer journey with daily operations. You avoid maintaining the same information across separate forms, lists and systems.",
    productGroups: [
      { title: "Win customers", text: "Shorten the path from interest to a real customer action.", items: ["Business page", "Online booking", "Quote requests", "Leads"] },
      { title: "Manage customers", text: "Keep the relationship and history in one place.", items: ["Customer CRM", "Customer history", "Customer portal", "Bookings"] },
      { title: "Run the job", text: "Move work forward without manual side lists.", items: ["Quotes", "Jobs", "Status", "Calendar and staff"] },
      { title: "Follow up", text: "See what works and build the next customer opportunity.", items: ["Verified reviews", "Gallery", "Analytics", "Reminders"] },
    ],
    pricingEyebrow: "Pricing",
    pricingTitle: "Start simple and grow when you need more",
    pricingLead: "Every plan is built around the same customer flow. Professional adds the public sales surface and more tools for a growing team.",
    popular: "Most popular",
    plans: [
      { name: "Starter", price: "From SEK 299/month", description: "For small businesses that want bookings, leads and customers in one place.", features: ["Online booking", "Lead management", "Customer CRM", "Customer portal", "Reminders"], cta: "Start free", href: "/en/create-account?plan=starter" },
      { name: "Professional", price: "From SEK 699/month", description: "For businesses that want to show services online and run more of the customer journey in Proffera.", features: ["Everything in Starter", "Business page", "Quotes", "Gallery and verified reviews", "Analytics", "Multiple staff"], cta: "Start free", href: "/en/create-account?plan=professional" },
      { name: "Business", price: "Custom pricing", description: "For larger or more advanced setups with needs beyond the standard workflow.", features: ["Everything in Professional", "Custom domain", "Advanced workflows", "Tailored setup", "Priority dialogue"], cta: "Contact us", href: "/en/contact" },
    ],
    faqEyebrow: "Common questions",
    faqTitle: "What to know before you start",
    faqs: [
      { question: "Is Proffera a marketplace like Offerta?", answer: "No. Proffera currently gives each business its own operating system and public customer surface. Each business shows its own services and manages its own customers, bookings and quotes." },
      { question: "Can customers book without creating an account?", answer: "Yes. The public booking flow is designed for a simple customer journey, with self-service available for managing a booking." },
      { question: "Can different services use different next steps?", answer: "Yes. A published service can lead to online booking, a quote request, contact, or both booking and quote depending on how the business works." },
      { question: "Can I use my own domain?", answer: "Custom domains are available for Business setups. Existing booking domains remain booking-first until the business explicitly switches the root to its business page." },
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

export function MarketingHome({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const signupHref = locale === "en" ? "/en/create-account" : "/skapa-konto";
  const demoHref = locale === "en" ? "/en/demo" : "/demo";

  return (
    <div className="overflow-hidden bg-[#f6f8f4]">
      <section className="relative border-b border-[#e2e8df] bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(73,144,98,0.16),transparent_31%),radial-gradient(circle_at_12%_90%,rgba(220,182,99,0.11),transparent_28%)]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:px-8 lg:py-24">
          <div>
            <p className="inline-flex rounded-full border border-[#cfe0d3] bg-[#f7fbf8] px-4 py-2 text-sm font-bold text-[#17452f]">{t.badge}</p>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-[#17201a] sm:text-5xl lg:text-[4rem]">{t.title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#526057]">{t.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={signupHref}>{t.primaryCta}</ButtonLink>
              <ButtonLink href="#sa-fungerar" variant="secondary">{t.secondaryCta}</ButtonLink>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#667168]">{t.micro.map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#2f7b53]" />{item}</span>)}</div>
          </div>

          <div className="relative rounded-[1.8rem] border border-[#dce5db] bg-[#f9fbf8] p-4 shadow-[0_28px_70px_rgba(23,69,47,.13)] sm:p-5">
            <div className="rounded-[1.35rem] border border-[#e0e7de] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-[#e8ece6] pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#748078]">{t.workspaceExample}</p><p className="mt-1 text-xl font-black text-[#17201a]">Proffera · {t.today}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173e2b] text-white"><LayoutDashboard className="h-5 w-5" /></span></div>
              <div className="mt-5 grid grid-cols-2 gap-3">{t.metrics.map((metric) => <div key={metric.label} className="rounded-2xl bg-[#f4f7f3] p-4"><p className="text-2xl font-black text-[#173e2b]">{metric.value}</p><p className="mt-1 text-xs font-bold text-[#69746d]">{metric.label}</p></div>)}</div>
              <div className="mt-5 rounded-2xl border border-[#e3e9e1] p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#748078]">{t.activityTitle}</p><div className="mt-3 grid gap-3">{t.activities.map((activity, index) => <div key={`${activity.time}-${activity.text}`} className="flex items-start gap-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${index === 0 ? "bg-[#2f875d]" : "bg-[#c7d5ca]"}`} /><span className="w-11 shrink-0 text-xs font-bold text-[#7a847d]">{activity.time}</span><span className="text-sm font-semibold text-[#344139]">{activity.text}</span></div>)}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="sa-fungerar" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-3xl"><p className="text-sm font-black uppercase tracking-[0.14em] text-[#17452f]">{t.lifecycleEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17201a] sm:text-4xl">{t.lifecycleTitle}</h2><p className="mt-4 text-base leading-7 text-[#5b665f]">{t.lifecycleLead}</p></div>
        <div className="mt-9 grid gap-3 lg:grid-cols-5">{t.lifecycle.map((step, index) => { const Icon = lifecycleIcons[index]; return <article key={step.title} className="relative rounded-2xl border border-[#dfe5dd] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf2ec] text-[#17452f]"><Icon className="h-5 w-5" /></span><span className="text-xs font-black text-[#9aa39d]">0{index + 1}</span></div><h3 className="mt-5 font-black text-[#17201a]">{step.title}</h3><p className="mt-2 text-sm leading-6 text-[#667168]">{step.text}</p>{index < t.lifecycle.length - 1 ? <ArrowRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 text-[#8ba395] lg:block" /> : null}</article>; })}</div>
      </section>

      <section className="border-y border-[#e1e8df] bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:px-8">
          <div><p className="text-sm font-black uppercase tracking-[0.14em] text-[#17452f]">{t.storefrontEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17201a] sm:text-4xl">{t.storefrontTitle}</h2><p className="mt-4 text-base leading-7 text-[#5b665f]">{t.storefrontLead}</p><p className="mt-5 rounded-2xl bg-[#eff5f0] p-4 text-sm font-semibold leading-6 text-[#28523b]">{t.storefrontNote}</p></div>
          <div className="rounded-[1.75rem] border border-[#dfe5dd] bg-[#f6f8f4] p-4 sm:p-5"><div className="rounded-[1.35rem] bg-white p-5 shadow-sm ring-1 ring-[#e1e7df]"><div className="flex items-center gap-3 border-b border-[#e7ebe5] pb-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173e2b] font-black text-white">A</span><div><p className="font-black text-[#17201a]">ABC Service</p><p className="text-xs text-[#6f7972]">{locale === "en" ? "Our services" : "Våra tjänster"}</p></div></div><div className="mt-4 grid gap-3">{t.services.map((service) => <article key={service.name} className="rounded-2xl border border-[#e0e6de] p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black text-[#17201a]">{service.name}</h3><p className="mt-1 text-sm text-[#6a756d]">{service.detail}</p><p className="mt-2 text-sm font-black text-[#17452f]">{service.price}</p></div><span className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-[#173e2b] px-4 text-sm font-black text-white">{service.action}<ArrowRight className="ml-2 h-4 w-4" /></span></div></article>)}</div></div></div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-start"><div className="lg:sticky lg:top-28"><p className="text-sm font-black uppercase tracking-[0.14em] text-[#17452f]">{t.productEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17201a] sm:text-4xl">{t.productTitle}</h2><p className="mt-4 text-base leading-7 text-[#5b665f]">{t.productLead}</p></div><div className="grid gap-4 sm:grid-cols-2">{t.productGroups.map((group, index) => { const Icon = groupIcons[index]; return <article key={group.title} className="rounded-3xl border border-[#dfe5dd] bg-white p-6 shadow-sm"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf2ec] text-[#17452f]"><Icon className="h-5 w-5" /></span><h3 className="mt-5 text-xl font-black text-[#17201a]">{group.title}</h3><p className="mt-2 text-sm leading-6 text-[#667168]">{group.text}</p><ul className="mt-5 grid gap-2">{group.items.map((item) => <li key={item} className="flex items-center gap-2 text-sm font-semibold text-[#344139]"><CheckCircle2 className="h-4 w-4 shrink-0 text-[#2f7b53]" />{item}</li>)}</ul></article>; })}</div></div>
      </section>

      <section className="border-y border-[#e1e8df] bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mx-auto max-w-3xl text-center"><p className="text-sm font-black uppercase tracking-[0.14em] text-[#17452f]">{t.pricingEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17201a] sm:text-4xl">{t.pricingTitle}</h2><p className="mt-4 text-base leading-7 text-[#5b665f]">{t.pricingLead}</p></div><div className="mt-10 grid gap-5 lg:grid-cols-3">{t.plans.map((plan) => { const popular = plan.name === "Professional"; return <article key={plan.name} className={`relative rounded-[1.7rem] border p-6 ${popular ? "border-[#17452f] bg-[#f7fbf8] shadow-[0_18px_50px_rgba(23,69,47,.12)]" : "border-[#dfe5dd] bg-white"}`}>{popular ? <span className="absolute right-5 top-0 -translate-y-1/2 rounded-full bg-[#173e2b] px-3 py-1 text-xs font-black text-white">{t.popular}</span> : null}<h3 className="text-2xl font-black text-[#17201a]">{plan.name}</h3><p className="mt-3 text-3xl font-black tracking-tight text-[#17452f]">{plan.price}</p><p className="mt-3 min-h-12 text-sm leading-6 text-[#5b665f]">{plan.description}</p><ul className="mt-6 grid gap-2.5">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm font-semibold text-[#344139]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7b53]" />{feature}</li>)}</ul><div className="mt-7"><ButtonLink href={plan.href} variant={popular ? "primary" : "secondary"} className="w-full">{plan.cta}</ButtonLink></div></article>; })}</div></div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"><div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr]"><div><p className="text-sm font-black uppercase tracking-[0.14em] text-[#17452f]">{t.faqEyebrow}</p><h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-[#17201a]">{t.faqTitle}</h2></div><div className="grid gap-3">{t.faqs.map((item) => <article key={item.question} className="rounded-2xl border border-[#dfe5dd] bg-white p-5"><h3 className="font-black text-[#17201a]">{item.question}</h3><p className="mt-2 text-sm leading-7 text-[#5b665f]">{item.answer}</p></article>)}</div></div></section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8"><div className="relative overflow-hidden rounded-[2rem] bg-[#102a1c] p-8 text-white sm:p-10 lg:p-12"><div className="absolute -right-12 -top-16 h-64 w-64 rounded-full bg-[#3b8f65]/25 blur-3xl" aria-hidden="true" /><MessageSquareText className="relative h-9 w-9 text-[#e8c678]" /><p className="relative mt-5 text-sm font-black uppercase tracking-[0.14em] text-[#bfd1c4]">{t.finalEyebrow}</p><h2 className="relative mt-2 max-w-3xl text-3xl font-black tracking-[-0.03em] sm:text-4xl">{t.finalTitle}</h2><p className="relative mt-4 max-w-2xl text-base leading-7 text-white/75">{t.finalLead}</p><div className="relative mt-7 flex flex-col gap-3 sm:flex-row"><ButtonLink href={signupHref}>{t.finalPrimary}</ButtonLink><ButtonLink href={demoHref} variant="secondary">{t.finalSecondary}</ButtonLink></div></div></section>
    </div>
  );
}
