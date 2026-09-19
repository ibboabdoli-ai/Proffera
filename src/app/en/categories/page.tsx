import Link from "next/link";
import { ArrowRight } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Categories",
  description: "Explore the functional product categories that make up the Proffera customer workflow.",
  englishPath: "/en/categories",
  swedishPath: "/kategorier",
});

const categories = [
  "Online booking",
  "Lead management",
  "Customer CRM",
  "Quotes",
  "Customer portal",
  "Business page",
  "Gallery",
  "Verified reviews",
  "Analytics",
  "Reminders",
] as const;

export default function EnglishCategoriesPage() {
  return (
    <main className={styles.landing} lang="en">
      <section className={styles.landingHero}>
        <div className={styles.landingInner}>
          <div className={styles.landingGrid}>
            <div>
              <p className={styles.landingEyebrow}>Categories</p>
              <h1 className={styles.landingTitle}>The parts that make up a service business customer workflow.</h1>
              <p className={styles.landingLead}>Proffera brings together the functions used from first customer contact to follow-up. Which modules are active depends on the workspace and plan.</p>
              <div className={styles.actions} style={{ marginTop: "1.5rem" }}>
                <Link href="/en/services" className={styles.primaryButton}>See features <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/en/pricing" className={styles.secondaryButton}>See pricing</Link>
              </div>
            </div>
            <aside className={styles.landingAside}>
              <Link href="/kategorier" className={styles.link}>Svenska</Link>
              <p className={styles.sectionCopy}>These categories describe product functions, not a promise that every workspace has every module enabled.</p>
            </aside>
          </div>

          <ul className={styles.rowList} style={{ marginTop: "3rem" }}>
            {categories.map((category, index) => (
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
