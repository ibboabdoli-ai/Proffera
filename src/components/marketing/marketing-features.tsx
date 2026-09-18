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

import styles from "@/components/marketing/platform-marketing.module.css";
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
    <main className={styles.page} lang={locale}>
      <section className={styles.hero}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 className={styles.title}>{t.title}</h1>
          <p className={styles.lead}>{t.intro}</p>
          <div className={styles.actions}>
            <ButtonLink href={signupHref}>{t.primary}</ButtonLink>
            <ButtonLink href={pricingHref} variant="secondary">{t.secondary}</ButtonLink>
          </div>
          <ol className={styles.flowRail} aria-label={locale === "en" ? "Customer workflow" : "Kundflöde"}>
            {t.flow.map((item, index) => (
              <li key={item} className={styles.flowItem}>
                <span className={styles.flowNumber}>{String(index + 1).padStart(2, "0")}</span>
                {item}
                {index < t.flow.length - 1 ? <ArrowRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" /> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.sectionWhite}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>{locale === "en" ? "The product" : "Produkten"}</p>
              <h2 className={styles.sectionTitle}>{locale === "en" ? "One workspace behind the customer journey." : "En arbetsyta bakom hela kundresan."}</h2>
            </div>
            <p className={styles.sectionLead}>{locale === "en" ? "Each part has a clear job. The structure follows the customer from discovery to completed work and follow-up." : "Varje del har en tydlig uppgift. Strukturen följer kunden från första kontakt till genomfört jobb och uppföljning."}</p>
          </div>

          <ul className={styles.editorialList}>
            {t.groups.map(({ icon: Icon, title, description, items }) => (
              <li key={title} className={styles.editorialRow}>
                <span className={styles.rowMarker}><Icon aria-hidden="true" /></span>
                <div>
                  <h3 className={styles.rowTitle}>{title}</h3>
                  <p className={styles.rowText}>{description}</p>
                  <ul className={styles.sublist}>
                    {items.map((item) => (
                      <li key={item.title}>
                        <CheckCircle2 aria-hidden="true" />
                        <span><strong>{item.title}</strong> — {item.text}</span>
                      </li>
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
              <p className={styles.eyebrow}>{locale === "en" ? "Different next steps" : "Olika nästa steg"}</p>
              <h2 className={styles.sectionTitle}>{t.examplesTitle}</h2>
            </div>
            <p className={styles.sectionLead}>{t.examplesLead}</p>
          </div>
          <div className={styles.featureColumns}>
            {t.examples.map(({ icon: Icon, title, text }) => (
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
          <div className={styles.callout}>
            <span className={styles.calloutIcon}><Users aria-hidden="true" /></span>
            <div>
              <h2>{t.proofTitle}</h2>
              <p>{t.proofText}</p>
            </div>
          </div>
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
