import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";
import { serviceCategories } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kategorier",
  description: "Utforska funktionella tjänstekategorier i Proffera.",
};

export default function CategoriesPage() {
  return (
    <main className={styles.landing}>
      <section className={styles.landingHero}>
        <div className={styles.landingInner}>
          <div className={styles.landingGrid}>
            <div>
              <p className={styles.landingEyebrow}>Kategorier</p>
              <h1 className={styles.landingTitle}>Delarna som bygger företagets kundflöde.</h1>
              <p className={styles.landingLead}>Proffera samlar de funktioner som används från första kundkontakt till uppföljning. Vilka delar som är aktiva beror på workspace och plan.</p>
              <div className={styles.actions} style={{ marginTop: "1.5rem" }}>
                <Link href="/tjanster" className={styles.primaryButton}>Se funktioner <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/priser" className={styles.secondaryButton}>Se priser</Link>
              </div>
            </div>
            <aside className={styles.landingAside}>
              <Link href="/en/categories" className={styles.link}>English</Link>
              <p className={styles.sectionCopy}>Kategorierna beskriver produktfunktioner, inte löften om vilka moduler varje workspace har aktiverade.</p>
            </aside>
          </div>

          <ul className={styles.rowList} style={{ marginTop: "3rem" }}>
            {serviceCategories.map((category, index) => (
              <li key={category} className={styles.row}>
                <span className={styles.rowNumber}>{String(index + 1).padStart(2, "0")}</span>
                <div><h2 className={styles.rowTitle}>{category}</h2></div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
