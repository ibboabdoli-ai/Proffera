import type { Metadata } from "next";

import { QuoteRequestForm } from "@/features/quote-request/quote-request-form";
import styles from "@/features/quote-request/quote-request-marketplace.module.css";

export const metadata: Metadata = {
  title: "Få offerter",
  description: "Beskriv ditt uppdrag och bli matchad med lämpliga företag via Proffera.",
  alternates: {
    canonical: "/fa-offert",
    languages: { "sv-SE": "/fa-offert", en: "/en/get-quote" },
  },
};

type QuotePageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    service?: string | string[];
    city?: string | string[];
  }>;
};

function queryValue(value: string | string[] | undefined, maxLength = 120) {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first.trim().slice(0, maxLength) : "";
}

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const initialValues = {
    category: queryValue(params?.category),
    serviceType: queryValue(params?.service),
    city: queryValue(params?.city),
  };

  return (
    <main className={styles.page}>
      <section className={styles.pageShell}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Få offerter</p>
          <h1 className={styles.title}>Beskriv jobbet. Jämför rätt företag.</h1>
          <p className={styles.lead}>
            Fyll i tjänst, plats och vad du behöver hjälp med. Proffera använder uppgifterna för att matcha förfrågan med lämpliga företag.
          </p>
          <div className={styles.trustRow}>
            <span><i className={styles.trustDot}>✓</i>Gratis att skicka förfrågan</span>
            <span><i className={styles.trustDot}>✓</i>Dina uppgifter används för matchning</span>
            <span><i className={styles.trustDot}>✓</i>Jämför innan du väljer</span>
          </div>
        </div>

        <div className={styles.formWrap}>
          <QuoteRequestForm
            locale="sv"
            initialValues={initialValues}
            alternateLocaleHref="/en/get-quote?resume=1"
            alternateLocaleLabel="EN English"
          />
        </div>
      </section>
    </main>
  );
}
