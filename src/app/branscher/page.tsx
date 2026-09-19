import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { MarketingIndustries } from "@/components/marketing/marketing-industries";
import styles from "@/components/marketing/platform-marketing.module.css";
import { marketingIndustryPages } from "@/lib/marketing-industry-pages";

export const metadata: Metadata = {
  title: {
    absolute: "Branscher – Proffera för tjänsteföretag",
  },
  description:
    "Proffera passar tjänsteföretag som behöver onlinebokning, offertförfrågningar, kund-CRM, uppdrag och uppföljning – från städning och salong till teknisk service.",
};

export default function IndustriesPage() {
  return (
    <>
      <MarketingIndustries locale="sv" />
      <section className={styles.sectionWhite}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Branschguider</p>
              <h2 className={styles.sectionTitle}>Se hur Proffera passar olika tjänsteföretag</h2>
            </div>
            <p className={styles.sectionLead}>Varje guide fokuserar på det kundflöde som är mest relevant för branschen – utan att skapa en separat produktversion.</p>
          </div>
          <ul className={styles.linkList}>
            {Object.values(marketingIndustryPages).map((page) => (
              <li key={page.slug} className={styles.linkRow}>
                <Link href={`/branscher/${page.slug}`}>
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
