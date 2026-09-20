import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { MarketingFeatures } from "@/components/marketing/marketing-features";
import styles from "@/components/marketing/platform-marketing.module.css";
import { createSwedishMetadata } from "@/lib/english-metadata";
import { marketingServicePages } from "@/lib/marketing-service-pages";

export const metadata = createSwedishMetadata({
  title: "Funktioner – Företagssida, bokning, CRM och offerter | Proffera",
  description:
    "Se hur Proffera kopplar ihop företagssida, onlinebokning, offertförfrågningar, kund-CRM, uppdrag, omdömen och analys i ett arbetsflöde.",
  swedishPath: "/tjanster",
  englishPath: "/en/services",
});

export default function ServicesPage() {
  return (
    <>
      <MarketingFeatures locale="sv" />
      <section className={styles.sectionWhite}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Fördjupa dig</p>
              <h2 className={styles.sectionTitle}>Läs mer om de viktigaste delarna i Proffera</h2>
            </div>
            <p className={styles.sectionLead}>Se hur varje del fungerar i ett tjänsteföretags kundresa och vilket problem den är tänkt att lösa.</p>
          </div>
          <ul className={styles.linkList}>
            {Object.values(marketingServicePages).map((page) => (
              <li key={page.slug} className={styles.linkRow}>
                <Link href={`/tjanster/${page.slug}`}>
                  <div>
                    <h3>{page.navLabel}</h3>
                    <p>{page.description}</p>
                  </div>
                  <ArrowRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
