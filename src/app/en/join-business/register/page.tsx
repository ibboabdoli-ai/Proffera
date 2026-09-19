import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";

import styles from "@/app/remaining-public-experience.module.css";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Request a Proffera demo",
  description: "Tell us about your business to request a relevant Proffera demo.",
  englishPath: "/en/join-business/register",
  swedishPath: "/anslut-foretag/registrera",
});

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function EnglishRegistrationPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <main className={styles.page} lang="en">
      <div className={styles.topbar}>
        <Link className={styles.backLink} href="/en/join-business"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back</Link>
        <Link className={styles.topbarLanguage} href="/anslut-foretag/registrera">Svenska</Link>
      </div>
      <div className={styles.formShell}>
        <section className={styles.formIntro}>
          <p className={styles.eyebrow}>Book a demo</p>
          <h1 className={styles.title}>Tell us a little about your business.</h1>
          <p className={styles.intro}>We use this information to prepare a relevant Proffera demo for your customer workflow.</p>
          <ul className={styles.heroList}>
            <li><CheckCircle2 className={[styles.heroIcon, "h-5 w-5"].join(" ")} aria-hidden="true" />Bookings, leads and customers in one place.</li>
            <li><CheckCircle2 className={[styles.heroIcon, "h-5 w-5"].join(" ")} aria-hidden="true" />A walkthrough based on your services and locations.</li>
            <li><ShieldCheck className={[styles.heroIcon, "h-5 w-5"].join(" ")} aria-hidden="true" />No booking or payment is created here.</li>
          </ul>
        </section>
        <section className={styles.formBody}>
          <h2 className={styles.sectionTitle} style={{ fontSize: "1.5rem" }}>Send your request</h2>
          <p className={styles.sectionCopy}>Fields marked * are required.</p>
          {error ? <p className={[styles.notice, styles.error].join(" ")} role="alert" style={{ marginTop: "1rem" }}>{error}</p> : null}
          <form action="/api/foretag" method="post" className={styles.form} style={{ marginTop: "1.4rem" }}>
            <input name="locale" type="hidden" value="en" />
            <label style={{ position: "absolute", left: "-10000px" }} aria-hidden="true">Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
            <div className={styles.twoColumns}>
              <label className={styles.field}>Company name *<input autoComplete="organization" className={styles.input} name="companyName" minLength={2} maxLength={120} required /></label>
              <label className={styles.field}>Organisation number *<input className={styles.input} inputMode="numeric" name="organizationNumber" minLength={6} maxLength={32} required /></label>
              <label className={styles.field}>Contact person *<input autoComplete="name" className={styles.input} name="contactPerson" minLength={2} maxLength={120} required /></label>
              <label className={styles.field}>Email *<input autoComplete="email" className={styles.input} name="email" required type="email" /></label>
              <label className={styles.field}>Phone *<input autoComplete="tel" className={styles.input} name="phone" minLength={6} maxLength={40} required type="tel" /></label>
              <label className={styles.field}>City *<input autoComplete="address-level2" className={styles.input} name="city" minLength={2} maxLength={120} required /></label>
            </div>
            <label className={styles.field}>Where do you work? *<input className={styles.input} name="serviceAreas" minLength={2} maxLength={300} placeholder="For example, Malmö and Lund" required /></label>
            <label className={styles.field}>Which services do you offer? *<input className={styles.input} name="services" minLength={2} maxLength={300} placeholder="For example, electrical installation and service" required /></label>
            <label className={styles.field}>What would you like to improve? *<textarea className={styles.textarea} name="description" minLength={20} maxLength={2000} placeholder="Tell us briefly about your customer workflow or what you want to see in the demo." required /><span className={styles.help}>Write at least 20 characters.</span></label>
            <label className={styles.consent}><input name="consentAccepted" required type="checkbox" /><span>I agree that Proffera may contact me about my demo request.</span></label>
            <button className={[styles.primaryButton, styles.fullButton].join(" ")} type="submit">Send demo request</button>
            <p className={styles.secureLine}>The form does not send email automatically.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
