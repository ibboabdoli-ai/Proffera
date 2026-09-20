import { CheckCircle2, Sparkles } from "lucide-react";

import styles from "@/components/marketing/platform-marketing.module.css";
import { ButtonLink } from "@/components/ui/button-link";
import { getCheckoutPlanPriceLabel } from "@/lib/billing-plans";
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
        price: getCheckoutPlanPriceLabel("starter", "SEK", "sv"),
        description: "För små tjänsteföretag som vill samla bokningar, leads och kunder i ett system.",
        features: ["Onlinebokning", "Leadhantering", "Kund-CRM", "Kundportal", "Bokningspåminnelser"],
        cta: "Starta gratis",
        href: "/skapa-konto?plan=starter",
      },
      {
        name: "Professional",
        price: getCheckoutPlanPriceLabel("professional", "SEK", "sv"),
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
        price: getCheckoutPlanPriceLabel("starter", "SEK", "en"),
        description: "For small service businesses that want bookings, leads and customers in one system.",
        features: ["Online booking", "Lead management", "Customer CRM", "Customer portal", "Booking reminders"],
        cta: "Start free",
        href: "/en/create-account?plan=starter",
      },
      {
        name: "Professional",
        price: getCheckoutPlanPriceLabel("professional", "SEK", "en"),
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
    <main className={styles.page} lang={locale}>
      <section className={styles.hero}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.lead}>{t.intro}</p>
          <div className={styles.callout} style={{ marginTop: "1.5rem", maxWidth: "48rem" }}>
            <span className={styles.calloutIcon}><Sparkles aria-hidden="true" /></span>
            <div><h2>{locale === "en" ? "14-day trial" : "14 dagars provperiod"}</h2><p>{t.trial}</p></div>
          </div>
        </div>
      </section>

      <section className={styles.sectionSoft}>
        <div className={styles.compactInner}>
          <div className={styles.priceGrid}>
            {t.plans.map((plan) => {
              const popular = plan.name === "Professional";
              return (
                <article key={plan.name} className={[styles.priceCard, popular ? styles.priceCardPopular : ""].filter(Boolean).join(" ")}>
                  {popular ? <span className={styles.popularBadge}>{t.popular}</span> : null}
                  <h2 className={styles.planName}>{plan.name}</h2>
                  <p className={styles.planPrice}>{plan.price}</p>
                  <p className={styles.planDescription}>{plan.description}</p>
                  <div className={styles.planDivider}>
                    <p className={styles.planLabel}>{t.included}</p>
                    <ul className={styles.planFeatures}>
                      {plan.features.map((feature) => (
                        <li key={feature}><CheckCircle2 aria-hidden="true" />{feature}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={styles.planAction}>
                    <ButtonLink href={plan.href} variant={popular ? "primary" : "secondary"} className="w-full">{plan.cta}</ButtonLink>
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.callout} style={{ marginTop: "1.25rem" }}>
            <span className={styles.calloutIcon}><Sparkles aria-hidden="true" /></span>
            <div><h2>{t.noteTitle}</h2><p>{t.noteText}</p></div>
          </div>
        </div>
      </section>

      <section className={styles.sectionWhite}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{locale === "en" ? "Questions" : "Frågor"}</p>
              <h2 className={styles.sectionTitle}>{t.faqTitle}</h2>
            </div>
            <p className={styles.sectionLead}>{locale === "en" ? "Clear answers about trial, plan selection and what happens when the trial ends." : "Tydliga svar om provperiod, planval och vad som händer när provperioden tar slut."}</p>
          </div>
          <ul className={styles.faqList}>
            {t.faqs.map((item) => (
              <li key={item.q} className={styles.faqItem}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
