import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Join Proffera as a business",
  description: "Information for businesses that want to receive relevant enquiries through Proffera.",
  englishPath: "/en/join-business",
  swedishPath: "/anslut-foretag",
});

const benefits = [
  ["Relevant enquiries", "Receive and follow customer enquiries that match your services and operating area."],
  ["A clear business profile", "Keep services, contact routes and verified business information together on a public page."],
  ["One operational workflow", "Continue with leads, customers, quotes, bookings and jobs in the same workspace."],
] as const;

export default function EnglishJoinBusinessPage() {
  return (
    <main className={styles.landing} lang="en">
      <section className={styles.landingHero}>
        <div className={styles.landingInner}>
          <div className={styles.landingGrid}>
            <div>
              <p className={styles.landingEyebrow}>For businesses</p>
              <h1 className={styles.landingTitle}>Win customers and move the work forward in one flow.</h1>
              <p className={styles.landingLead}>Proffera connects the public business profile with enquiries, bookings, CRM and jobs without replacing the data or permissions that already govern your business.</p>
              <div className={styles.actions} style={{ marginTop: "1.5rem" }}>
                <Link href="/en/join-business/register" className={styles.primaryButton}>Book a demo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/logga-in?lang=en" className={styles.secondaryButton}>Log in</Link>
              </div>
            </div>
            <aside className={styles.landingAside}>
              <Link href="/anslut-foretag" className={styles.link}>Svenska</Link>
              <p className={styles.sectionCopy}>Business information and authority are verified before a public profile is connected to a workspace.</p>
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
            No payment or booking is created when you send a demo request.
          </p>
        </div>
      </section>
    </main>
  );
}
