import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";

export const metadata: Metadata = {
  title: "Anslut företag",
  description: "Information för företag som vill ta emot relevanta uppdrag via Proffera.",
};

const benefits = [
  ["Relevanta förfrågningar", "Ta emot och följ kundförfrågningar som matchar företagets tjänster och område."],
  ["Tydlig företagsprofil", "Samla tjänster, kontaktvägar och verifierad företagsinformation på en publik sida."],
  ["Ett operativt arbetsflöde", "Fortsätt med leads, kunder, offerter, bokningar och uppdrag i samma workspace."],
] as const;

export default function JoinCompanyPage() {
  return (
    <main className={styles.landing}>
      <section className={styles.landingHero}>
        <div className={styles.landingInner}>
          <div className={styles.landingGrid}>
            <div>
              <p className={styles.landingEyebrow}>För företag</p>
              <h1 className={styles.landingTitle}>Ta emot kunder och driv arbetet vidare i samma flöde.</h1>
              <p className={styles.landingLead}>Proffera kopplar ihop företagets publika profil med förfrågningar, bokningar, CRM och uppdrag utan att ersätta den information eller behörighet som redan styr verksamheten.</p>
              <div className={styles.actions} style={{ marginTop: "1.5rem" }}>
                <Link href="/anslut-foretag/registrera" className={styles.primaryButton}>Boka demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/logga-in" className={styles.secondaryButton}>Logga in</Link>
              </div>
            </div>
            <aside className={styles.landingAside}>
              <Link href="/en/join-business" className={styles.link}>English</Link>
              <p className={styles.sectionCopy}>Företagsuppgifter och behörigheter verifieras innan en offentlig profil kopplas till ett workspace.</p>
            </aside>
          </div>
          <ol className={styles.rowList} style={{ marginTop: "3rem" }}>
            {benefits.map(([title, text], index) => (
              <li key={title} className={styles.row}>
                <span className={styles.rowNumber}>0{index + 1}</span>
                <div><h2 className={styles.rowTitle}>{title}</h2><p className={styles.rowText}>{text}</p></div>
              </li>
            ))}
          </ol>
          <p className={[styles.notice, styles.info].join(" ")} style={{ marginTop: "2rem" }}>
            <CheckCircle2 className="mr-2 inline h-5 w-5" aria-hidden="true" />
            Ingen betalning eller bokning skapas när du skickar en demoförfrågan.
          </p>
        </div>
      </section>
    </main>
  );
}
