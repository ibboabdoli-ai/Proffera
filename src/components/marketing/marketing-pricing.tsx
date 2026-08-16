import { CheckCircle2, Sparkles } from "lucide-react";

import { ButtonLink } from "@/components/ui/button-link";
import type { PublicLocale } from "@/lib/public-locale";

const copy = {
  sv: {
    eyebrow: "Priser",
    title: "Börja med grunden och öppna fler delar av kundflödet när du behöver dem",
    intro: "Starter samlar kärnan för bokning, leads och kundhantering. Professional lägger till företagssida, offerter, omdömen, galleri och analys. Enterprise är för upplägg som behöver egen domän och en mer anpassad lösning.",
    trial: "Starter och Professional kan provas gratis i 14 dagar. Ingen betalning krävs för att starta provperioden.",
    popular: "Mest populär",
    included: "Det här ingår",
    plans: [
      {
        name: "Starter",
        price: "199 kr/mån",
        description: "För små tjänsteföretag som vill samla bokningar, leads och kunder i ett system.",
        features: ["Onlinebokning", "Leadhantering", "Kund-CRM", "Kundportal", "Bokningspåminnelser"],
        cta: "Starta gratis",
        href: "/skapa-konto?plan=starter",
      },
      {
        name: "Professional",
        price: "599 kr/mån",
        description: "För företag som vill visa tjänster online och hantera fler delar av kundresan i Proffera.",
        features: ["Allt i Starter", "Företagssida", "Offerter", "Galleri", "Verifierade omdömen", "Analys", "Flera medarbetare"],
        cta: "Starta gratis",
        href: "/skapa-konto?plan=professional",
      },
      {
        name: "Enterprise",
        price: "Anpassat pris",
        description: "För företag med mer avancerade behov där upplägget behöver anpassas tillsammans med oss.",
        features: ["Allt i Professional", "Egen domän", "Enterprise-funktioner efter behov", "Anpassad uppsättning"],
        cta: "Kontakta oss",
        href: "/kontakt",
      },
    ],
    noteTitle: "Planerna styr åtkomsten centralt",
    noteText: "När en arbetsyta byter plan följer funktionstillgången samma centrala planregler. Administrativa undantag kan användas vid behov utan att skapa separata produktversioner för varje kund.",
    faqTitle: "Vanliga frågor om pris och provperiod",
    faqs: [
      { q: "Behöver jag ange kort för att prova?", a: "Nej. Den nuvarande självservice-registreringen skapar en 14-dagars provperiod utan betalning vid start." },
      { q: "Kan jag välja Starter eller Professional direkt?", a: "Ja. Planvalet följer med genom registreringen och arbetsytan skapas med den valda provplanen." },
      { q: "Vad händer efter provperioden?", a: "För fortsatt användning behöver arbetsytan en aktiv plan. Vilka funktioner som ingår avgörs av planens centrala behörighetsregler." },
      { q: "Varför har Enterprise inget fast pris?", a: "Enterprise är avsett för upplägg som behöver egen domän eller andra mer avancerade behov och prissätts därför efter upplägget." },
    ],
  },
  en: {
    eyebrow: "Pricing",
    title: "Start with the core and unlock more of the customer flow when you need it",
    intro: "Starter covers the core for booking, leads and customer management. Professional adds the business page, quotes, reviews, gallery and analytics. Enterprise is for setups that need a custom domain and a more tailored solution.",
    trial: "Starter and Professional include a 14-day free trial. No payment is required to start the trial.",
    popular: "Most popular",
    included: "Included",
    plans: [
      {
        name: "Starter",
        price: "SEK 199/month",
        description: "For small service businesses that want bookings, leads and customers in one system.",
        features: ["Online booking", "Lead management", "Customer CRM", "Customer portal", "Booking reminders"],
        cta: "Start free",
        href: "/en/create-account?plan=starter",
      },
      {
        name: "Professional",
        price: "SEK 599/month",
        description: "For businesses that want to show services online and run more of the customer journey in Proffera.",
        features: ["Everything in Starter", "Business page", "Quotes", "Gallery", "Verified reviews", "Analytics", "Multiple staff"],
        cta: "Start free",
        href: "/en/create-account?plan=professional",
      },
      {
        name: "Enterprise",
        price: "Custom pricing",
        description: "For businesses with more advanced needs where the setup should be tailored together with us.",
        features: ["Everything in Professional", "Custom domain", "Enterprise capabilities as needed", "Tailored setup"],
        cta: "Contact us",
        href: "/en/contact",
      },
    ],
    noteTitle: "Plan access is controlled centrally",
    noteText: "When a workspace changes plan, feature access follows the same central plan rules. Administrative overrides can be used when needed without creating separate product versions for each customer.",
    faqTitle: "Common pricing and trial questions",
    faqs: [
      { q: "Do I need a card to start the trial?", a: "No. The current self-service signup creates a 14-day trial without payment at the start." },
      { q: "Can I choose Starter or Professional directly?", a: "Yes. The plan selection is carried through signup and the workspace is provisioned with the selected trial plan." },
      { q: "What happens after the trial?", a: "Continued use requires an active plan. Included capabilities are determined by the central entitlement rules for that plan." },
      { q: "Why does Enterprise not have a fixed price?", a: "Enterprise is intended for setups that need a custom domain or other advanced requirements, so pricing depends on the setup." },
    ],
  },
} as const;

export function MarketingPricing({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];

  return (
    <div className="overflow-hidden bg-[#f6f8f4]">
      <section className="border-b border-[#e1e7df] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#17452f]">{t.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.04em] text-[#17201a] sm:text-5xl">{t.title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">{t.intro}</p>
          <p className="mt-5 inline-flex rounded-full border border-[#cfe0d3] bg-[#f7fbf8] px-4 py-2 text-sm font-bold text-[#28523b]">{t.trial}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-5 lg:grid-cols-3">{t.plans.map((plan) => { const popular = plan.name === "Professional"; return <article key={plan.name} className={`relative flex flex-col rounded-[1.8rem] border p-6 sm:p-7 ${popular ? "border-[#17452f] bg-[#f7fbf8] shadow-[0_22px_60px_rgba(23,69,47,.13)]" : "border-[#dfe5dd] bg-white shadow-sm"}`}>{popular ? <span className="absolute right-6 top-0 -translate-y-1/2 rounded-full bg-[#173e2b] px-3 py-1.5 text-xs font-black text-white">{t.popular}</span> : null}<h2 className="text-2xl font-black text-[#17201a]">{plan.name}</h2><p className="mt-3 text-3xl font-black tracking-tight text-[#17452f]">{plan.price}</p><p className="mt-3 min-h-[4.5rem] text-sm leading-6 text-[#5b665f]">{plan.description}</p><div className="mt-6 border-t border-[#e2e7e0] pt-5"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#748078]">{t.included}</p><ul className="mt-4 grid gap-2.5">{plan.features.map((feature) => <li key={feature} className="flex gap-2 text-sm font-semibold text-[#344139]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f7b53]" />{feature}</li>)}</ul></div><div className="mt-auto pt-7"><ButtonLink href={plan.href} variant={popular ? "primary" : "secondary"} className="w-full">{plan.cta}</ButtonLink></div></article>; })}</div>

        <div className="mt-8 rounded-3xl border border-[#dce5db] bg-white p-6 sm:p-7"><div className="flex items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf2ec] text-[#17452f]"><Sparkles className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-[#17201a]">{t.noteTitle}</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-[#667168]">{t.noteText}</p></div></div></div>
      </section>

      <section className="border-t border-[#e1e7df] bg-white py-16"><div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[.65fr_1.35fr] lg:px-8"><h2 className="text-3xl font-black tracking-tight text-[#17201a]">{t.faqTitle}</h2><div className="grid gap-3">{t.faqs.map((item) => <article key={item.q} className="rounded-2xl border border-[#dfe5dd] bg-[#fbfcfa] p-5"><h3 className="font-black text-[#17201a]">{item.q}</h3><p className="mt-2 text-sm leading-7 text-[#5b665f]">{item.a}</p></article>)}</div></div></section>
    </div>
  );
}
