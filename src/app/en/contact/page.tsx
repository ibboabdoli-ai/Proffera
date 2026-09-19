import Link from "next/link";
import { Mail, MapPin, MessageSquare, ArrowRight } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Contact Proffera",
  description: "Contact Proffera to discuss booking, CRM, quotes and customer workflows for your service business.",
  englishPath: "/en/contact",
  swedishPath: "/kontakt",
});

const details = [
  [Mail, "Email", "leads@proffera.se"],
  [MapPin, "Market", "Sweden"],
  [MessageSquare, "Enquiries", "Demos, pilots and product questions"],
] as const;

export default function EnglishContactPage() {
  return (
    <main className={styles.landing} lang="en">
      <section className={styles.landingHero}>
        <div className={styles.landingInner}>
          <div className={styles.landingGrid}>
            <div>
              <p className={styles.landingEyebrow}>Contact</p>
              <h1 className={styles.landingTitle}>Talk to us about how Proffera fits your customer workflow.</h1>
              <p className={styles.landingLead}>Tell us briefly about your business, services and the workflow you want to improve. We will suggest the most relevant next step.</p>
              <div className={styles.actions} style={{ marginTop: "1.5rem" }}>
                <Link href="/en/join-business/register" className={styles.primaryButton}>Book a demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <a href="mailto:leads@proffera.se?subject=Proffera%20demo" className={styles.secondaryButton}>Send email</a>
              </div>
            </div>
            <aside className={styles.landingAside}>
              <Link href="/kontakt" className={styles.link}>Svenska</Link>
              <p className={styles.sectionCopy}>We use the contact details only to handle your enquiry and relevant follow-up.</p>
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
