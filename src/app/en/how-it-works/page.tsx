import Link from "next/link";
import { ArrowRight } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "How Proffera works",
  description: "How Proffera helps customers describe a job, compare real responses and choose a service business.",
  englishPath: "/en/how-it-works",
  swedishPath: "/hur-det-fungerar",
});

const steps = [
  ["Describe the need", "Choose a service and area, then describe the job in a guided flow."],
  ["Compare relevant responses", "Requests and offers stay structured so the customer can compare real alternatives."],
  ["Choose and continue", "Once the customer chooses a business, the contact and job continue without Proffera inventing data or choosing automatically."],
] as const;

export default function EnglishHowItWorksPage() {
  return (
    <main className={styles.landing} lang="en">
      <section className={styles.landingHero}>
        <div className={styles.landingInner}>
          <div className={styles.landingGrid}>
            <div>
              <p className={styles.landingEyebrow}>How it works</p>
              <h1 className={styles.landingTitle}>From a customer need to a chosen business in three clear steps.</h1>
              <p className={styles.landingLead}>Proffera makes the quote journey clearer without replacing the customer’s decision or a business’s own information.</p>
              <div className={styles.actions} style={{ marginTop: "1.5rem" }}>
                <Link href="/en/get-quote" className={styles.primaryButton}>Describe your job <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/en/companies" className={styles.secondaryButton}>Find businesses</Link>
              </div>
            </div>
            <aside className={styles.landingAside}>
              <Link href="/hur-det-fungerar" className={styles.link}>Svenska</Link>
              <p className={styles.sectionCopy}>The customer makes the choice. Proffera only shows information and responses that actually exist in the workflow.</p>
            </aside>
          </div>

          <ol className={styles.rowList} style={{ marginTop: "3rem" }}>
            {steps.map(([title, text], index) => (
              <li key={title} className={styles.row}>
                <span className={styles.rowNumber}>0{index + 1}</span>
                <div><h2 className={styles.rowTitle}>{title}</h2><p className={styles.rowText}>{text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
