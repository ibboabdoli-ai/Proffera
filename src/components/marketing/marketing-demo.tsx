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
  Star,
  Users,
} from "lucide-react";

import styles from "@/components/marketing/platform-marketing.module.css";
import { ButtonLink } from "@/components/ui/button-link";
import type { PublicLocale } from "@/lib/public-locale";

type DemoStep = {
  icon: LucideIcon;
  title: string;
  text: string;
  details: string[];
};

const copy = {
  sv: {
    eyebrow: "Demo",
    title: "Se hela kundresan – från tjänstesida till uppföljning",
    intro: "Demon fokuserar på det som redan finns i Proffera: hur kunden hittar en tjänst, bokar eller begär offert och hur företaget fortsätter med CRM, uppdrag, omdömen och analys.",
    primary: "Skicka demoförfrågan",
    secondary: "Starta gratis i 14 dagar",
    note: "Demoförfrågan är kostnadsfri och skapar ingen betalning.",
    steps: [
      {
        icon: Globe2,
        title: "1. Företagssida och tjänster",
        text: "Vi visar hur ett företag presenterar sina tjänster och låter varje tjänst ha rätt nästa steg.",
        details: ["Företagssida", "Tjänstekort och tjänstesidor", "Boka / begär offert / kontakta", "Galleri och omdömen"],
      },
      {
        icon: CalendarCheck2,
        title: "2. Bokning och offert",
        text: "Vi går igenom både den direkta bokningsvägen och jobb som först behöver en offertförfrågan.",
        details: ["Tjänst → ledig tid", "Kunduppgifter", "Offertförfrågan kopplad till tjänsten", "Kundens självservice"],
      },
      {
        icon: LayoutDashboard,
        title: "3. Dashboard, CRM och uppdrag",
        text: "Sedan följer vi samma kund in i företagets arbetsyta där historik och operativt arbete hålls samman.",
        details: ["Leads och kunder", "Kundhistorik", "Bokningar och offerter", "Uppdrag och status"],
      },
      {
        icon: BarChart3,
        title: "4. Uppföljning och analys",
        text: "Till sist visar vi hur ett slutfört jobb kan fortsätta till omdöme och hur den publika kundytan kan följas upp med analys.",
        details: ["Verifierade omdömen", "Tjänstevisningar", "Boknings-, offert- och kontaktklick", "30-dagars översikt"],
      },
    ] satisfies DemoStep[],
    flowEyebrow: "Exempel på demo",
    flowTitle: "En kund, ett sammanhängande flöde",
    flow: [
      { icon: Globe2, label: "Ser en tjänst" },
      { icon: FileText, label: "Bokar eller begär offert" },
      { icon: Users, label: "Skapas eller återanvänds i CRM" },
      { icon: ClipboardCheck, label: "Jobbet drivs till klart" },
      { icon: Star, label: "Följs upp med omdöme" },
    ],
    fitTitle: "Demon anpassas efter hur ditt företag arbetar",
    fitText: "Har du främst bokningar visar vi den vägen. Jobbar du mer med offertförfrågningar fokuserar vi på offert → kund → uppdrag. Målet är att du ska kunna bedöma Proffera utifrån ditt verkliga kundflöde.",
    finalTitle: "Vill du gå igenom ditt flöde med oss?",
    finalText: "Skicka en kort demoförfrågan. Om du hellre vill testa själv kan du starta en 14-dagars provperiod direkt.",
    finalPrimary: "Skicka demoförfrågan",
    finalSecondary: "Starta gratis",
  },
  en: {
    eyebrow: "Demo",
    title: "See the whole customer journey – from service page to follow-up",
    intro: "The demo focuses on what already exists in Proffera: how customers discover a service, book or request a quote, and how the business continues with CRM, jobs, reviews and analytics.",
    primary: "Request a demo",
    secondary: "Start free 14-day trial",
    note: "The demo request is free and does not create a payment.",
    steps: [
      {
        icon: Globe2,
        title: "1. Business page and services",
        text: "We show how a business presents its services and gives each service the right next step.",
        details: ["Business page", "Service cards and service pages", "Book / quote / contact", "Gallery and reviews"],
      },
      {
        icon: CalendarCheck2,
        title: "2. Booking and quotes",
        text: "We walk through both the direct booking path and jobs that first need a quote request.",
        details: ["Service → available time", "Customer details", "Quote request linked to the service", "Customer self-service"],
      },
      {
        icon: LayoutDashboard,
        title: "3. Dashboard, CRM and jobs",
        text: "Then we follow the same customer into the business workspace where history and operational work stay connected.",
        details: ["Leads and customers", "Customer history", "Bookings and quotes", "Jobs and status"],
      },
      {
        icon: BarChart3,
        title: "4. Follow-up and analytics",
        text: "Finally, we show how a completed job can continue into a review and how the public customer surface can be measured with analytics.",
        details: ["Verified reviews", "Service views", "Booking, quote and contact clicks", "30-day overview"],
      },
    ] satisfies DemoStep[],
    flowEyebrow: "Demo example",
    flowTitle: "One customer, one connected flow",
    flow: [
      { icon: Globe2, label: "Views a service" },
      { icon: FileText, label: "Books or requests a quote" },
      { icon: Users, label: "Created or reused in CRM" },
      { icon: ClipboardCheck, label: "Job moves to completion" },
      { icon: Star, label: "Followed up with a review" },
    ],
    fitTitle: "The demo is adapted to how your business works",
    fitText: "If bookings are your main flow, we focus there. If you work more with quote requests, we focus on quote → customer → job. The goal is to evaluate Proffera against your real customer journey.",
    finalTitle: "Want to walk through your workflow with us?",
    finalText: "Send a short demo request. If you prefer to explore on your own, you can start a 14-day trial immediately.",
    finalPrimary: "Request a demo",
    finalSecondary: "Start free",
  },
} as const;

export function MarketingDemo({ locale }: { locale: PublicLocale }) {
  const t = copy[locale];
  const demoRequestHref = locale === "en" ? "/en/join-business/register" : "/anslut-foretag/registrera";
  const signupHref = locale === "en" ? "/en/create-account" : "/skapa-konto";

  return (
    <main className={styles.page} lang={locale}>
      <section className={styles.hero}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.lead}>{t.intro}</p>
          <div className={styles.actions}>
            <ButtonLink href={demoRequestHref}>{t.primary}</ButtonLink>
            <ButtonLink href={signupHref} variant="secondary">{t.secondary}</ButtonLink>
          </div>
          <p className={styles.note}>{t.note}</p>
        </div>
      </section>

      <section className={styles.sectionWhite}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{locale === "en" ? "What we show" : "Det här visar vi"}</p>
              <h2 className={styles.sectionTitle}>{locale === "en" ? "A real workflow, step by step." : "Ett verkligt flöde, steg för steg."}</h2>
            </div>
            <p className={styles.sectionLead}>{locale === "en" ? "The demo follows one customer journey instead of jumping between disconnected feature screens." : "Demon följer en sammanhängande kundresa i stället för att hoppa mellan fristående funktionsskärmar."}</p>
          </div>
          <ol className={styles.editorialList}>
            {t.steps.map(({ icon: Icon, title, text, details }, index) => (
              <li key={title} className={styles.editorialRow}>
                <span className={styles.rowMarker}><Icon aria-hidden="true" /></span>
                <div>
                  <span className={styles.rowIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <h3 className={styles.rowTitle}>{title.replace(/^\d+\.\s*/, "")}</h3>
                  <p className={styles.rowText}>{text}</p>
                  <ul className={styles.sublist}>
                    {details.map((detail) => (
                      <li key={detail}><CheckCircle2 aria-hidden="true" /><span>{detail}</span></li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.sectionSoft}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{t.flowEyebrow}</p>
              <h2 className={styles.sectionTitle}>{t.flowTitle}</h2>
            </div>
            <p className={styles.sectionLead}>{locale === "en" ? "The same customer identity and service context continue through the workflow." : "Samma kundidentitet och tjänstekontext följer med genom flödet."}</p>
          </div>
          <ol className={styles.flowRail}>
            {t.flow.map(({ icon: Icon, label }, index) => (
              <li key={label} className={styles.flowItem}>
                <span className={styles.flowNumber}>{String(index + 1).padStart(2, "0")}</span>
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                {index < t.flow.length - 1 ? <ArrowRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" /> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.sectionWhite}>
        <div className={styles.compactInner}>
          <div className={styles.callout}>
            <span className={styles.calloutIcon}><LayoutDashboard aria-hidden="true" /></span>
            <div><h2>{t.fitTitle}</h2><p>{t.fitText}</p></div>
          </div>
        </div>
      </section>

      <section className={styles.sectionSoft}>
        <div className={styles.compactInner}>
          <div className={styles.ctaBand}>
            <h2>{t.finalTitle}</h2>
            <p>{t.finalText}</p>
            <div className={styles.actions}>
              <ButtonLink href={demoRequestHref}>{t.finalPrimary}</ButtonLink>
              <ButtonLink href={signupHref} variant="secondary">{t.finalSecondary}</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
