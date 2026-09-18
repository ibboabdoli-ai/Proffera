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

import styles from "@/components/marketing/platform-marketing.module.css";
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
    <main className={styles.page} lang={locale}>
      <section className={styles.hero}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.lead}>{t.intro}</p>
          <div className={styles.actions}>
            <ButtonLink href={signupHref}>{t.primary}</ButtonLink>
            <ButtonLink href={demoHref} variant="secondary">{t.secondary}</ButtonLink>
          </div>
        </div>
      </section>

      <section className={styles.sectionWhite}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{locale === "en" ? "Service businesses" : "Tjänsteföretag"}</p>
              <h2 className={styles.sectionTitle}>{locale === "en" ? "Different industries, the same connected customer workflow." : "Olika branscher, samma sammanhängande kundflöde."}</h2>
            </div>
            <p className={styles.sectionLead}>{locale === "en" ? "The public next step can differ by service while customer history and operational work stay together." : "Kundens nästa steg kan skilja sig mellan tjänster medan historik och operativt arbete hålls ihop."}</p>
          </div>

          <ul className={styles.editorialList}>
            {t.industries.map(({ icon: Icon, title, description, examples, primaryFlow }) => (
              <li key={title} className={styles.editorialRow}>
                <span className={styles.rowMarker}><Icon aria-hidden="true" /></span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={styles.rowTitle}>{title}</h3>
                    <span className="rounded-md border border-[#cddbeb] bg-[#f8fbff] px-2 py-1 text-[11px] font-black text-[#0a2e63]">{primaryFlow}</span>
                  </div>
                  <p className={styles.rowText}>{description}</p>
                  <ul className={styles.sublist}>
                    {examples.map((example) => (
                      <li key={example}><CheckCircle2 aria-hidden="true" /><span>{example}</span></li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.sectionSoft}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{t.modelEyebrow}</p>
              <h2 className={styles.sectionTitle}>{t.modelTitle}</h2>
            </div>
            <p className={styles.sectionLead}>{t.modelLead}</p>
          </div>
          <div className={styles.featureColumns}>
            {t.models.map(({ icon: Icon, title, text }) => (
              <article key={title} className={styles.featureColumn}>
                <Icon aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.sectionWhite}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{t.commonEyebrow}</p>
              <h2 className={styles.sectionTitle}>{t.commonTitle}</h2>
            </div>
            <p className={styles.sectionLead}>{locale === "en" ? "The operating model stays consistent even when the first customer action differs." : "Arbetssättet bakom kulisserna är konsekvent även när första kundsteget skiljer sig."}</p>
          </div>
          <ul className={styles.editorialList}>
            {t.commonItems.map((item, index) => (
              <li key={item} className={styles.editorialRow}>
                <span className={styles.rowIndex}>{String(index + 1).padStart(2, "0")}</span>
                <div><h3 className={styles.rowTitle}>{item}</h3></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.sectionSoft}>
        <div className={styles.compactInner}>
          <div className={styles.ctaBand}>
            <h2>{t.finalTitle}</h2>
            <p>{t.finalText}</p>
            <div className={styles.actions}>
              <ButtonLink href={signupHref}>{t.finalPrimary}</ButtonLink>
              <ButtonLink href={demoHref} variant="secondary">{t.finalSecondary}</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
