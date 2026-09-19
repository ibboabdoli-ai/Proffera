import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";

export const metadata: Metadata = {
  title: "Hur det fungerar",
  description: "Så hjälper Proffera kunder att beskriva uppdrag och jämföra svar från företag.",
};

const steps = [
  ["Beskriv behovet", "Välj tjänst och område och beskriv uppdraget i ett guidat flöde."],
  ["Jämför relevanta svar", "Förfrågningar och offerter hålls strukturerade så att kunden kan jämföra verkliga alternativ."],
  ["Välj och fortsätt", "När kunden väljer företag fortsätter kontakten och jobbet utan att Proffera hittar på data eller automatiskt väljer åt kunden."],
] as const;

export default function HowItWorksPage() {
  return (
    <main className={styles.landing}>
      <section className={styles.landingHero}>
        <div className={styles.landingInner}>
          <div className={styles.landingGrid}>
            <div>
              <p className={styles.landingEyebrow}>Så fungerar det</p>
              <h1 className={styles.landingTitle}>Från behov till valt företag i tre tydliga steg.</h1>
              <p className={styles.landingLead}>Proffera gör offertprocessen tydligare utan att ersätta kundens beslut eller företagets egna uppgifter.</p>
              <div className={styles.actions} style={{ marginTop: "1.5rem" }}>
                <Link href="/fa-offert" className={styles.primaryButton}>Beskriv ditt uppdrag <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/foretag/listad" className={styles.secondaryButton}>Hitta företag</Link>
              </div>
            </div>
            <aside className={styles.landingAside}>
              <Link href="/en/how-it-works" className={styles.link}>English</Link>
              <p className={styles.sectionCopy}>Kunden väljer själv. Proffera visar bara den information och de svar som faktiskt finns i flödet.</p>
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
