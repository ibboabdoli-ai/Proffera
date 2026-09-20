import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MessageSquare, ArrowRight } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";

export const metadata: Metadata = {
  title: { absolute: "Kontakt – Proffera" },
  description: "Kontakta Proffera för demo eller frågor om bokning, CRM, offerter och kundflöden för tjänsteföretag.",
};

const details = [
  [Mail, "E-post", "leads@proffera.se"],
  [MapPin, "Marknad", "Sverige"],
  [MessageSquare, "Ärenden", "Demo, pilot och produktfrågor"],
] as const;

export default function ContactPage() {
  return (
    <main className={styles.landing}>
      <section className={styles.landingHero}>
        <div className={styles.landingInner}>
          <div className={styles.landingGrid}>
            <div>
              <p className={styles.landingEyebrow}>Kontakt</p>
              <h1 className={styles.landingTitle}>Prata med oss om hur Proffera passar ert kundflöde.</h1>
              <p className={styles.landingLead}>Beskriv kort företaget, tjänsterna och det flöde ni vill förbättra. Vi återkommer med nästa lämpliga steg.</p>
              <div className={styles.actions} style={{ marginTop: "1.5rem" }}>
                <Link href="/anslut-foretag/registrera" className={styles.primaryButton}>Boka demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <a href="mailto:leads@proffera.se?subject=Demo%20Proffera" className={styles.secondaryButton}>Skicka e-post</a>
              </div>
            </div>
            <aside className={styles.landingAside}>
              <Link href="/en/contact" className={styles.link}>English</Link>
              <p className={styles.sectionCopy}>Vi använder kontaktuppgifterna bara för att hantera din förfrågan och relevant uppföljning.</p>
            </aside>
          </div>

          <div className={styles.rowList} style={{ marginTop: "3rem" }}>
            {details.map(([Icon, label, value]) => (
              <div key={label} className={styles.row}>
                <span className={styles.rowNumber}><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <div><h2 className={styles.rowTitle}>{label}</h2><p className={styles.rowText}>{value}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
