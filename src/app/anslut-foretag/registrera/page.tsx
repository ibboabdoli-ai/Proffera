import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";

import styles from "@/app/remaining-public-experience.module.css";

type PageProps = { searchParams: Promise<{ error?: string }> };

export default async function Page({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link className={styles.backLink} href="/anslut-foretag"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Tillbaka</Link>
        <Link className={styles.topbarLanguage} href="/en/join-business/register">English</Link>
      </div>
      <div className={styles.formShell}>
        <section className={styles.formIntro}>
          <p className={styles.eyebrow}>Boka demo</p>
          <h1 className={styles.title}>Berätta kort om företaget.</h1>
          <p className={styles.intro}>Vi använder uppgifterna för att förbereda en relevant demo av Proffera för ert kundflöde.</p>
          <ul className={styles.heroList}>
            <li><CheckCircle2 className={[styles.heroIcon, "h-5 w-5"].join(" ")} aria-hidden="true" />Bokning, leads och kunder samlat på ett ställe.</li>
            <li><CheckCircle2 className={[styles.heroIcon, "h-5 w-5"].join(" ")} aria-hidden="true" />Genomgång utifrån era tjänster och orter.</li>
            <li><ShieldCheck className={[styles.heroIcon, "h-5 w-5"].join(" ")} aria-hidden="true" />Ingen bokning eller betalning skapas här.</li>
          </ul>
        </section>
        <section className={styles.formBody}>
          <h2 className={styles.sectionTitle} style={{ fontSize: "1.5rem" }}>Skicka din förfrågan</h2>
          <p className={styles.sectionCopy}>Fält med * är obligatoriska.</p>
          {error ? <p className={[styles.notice, styles.error].join(" ")} role="alert" style={{ marginTop: "1rem" }}>{error}</p> : null}
          <form action="/api/foretag" method="post" className={styles.form} style={{ marginTop: "1.4rem" }}>
            <label style={{ position: "absolute", left: "-10000px" }} aria-hidden="true">Webbplats<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
            <div className={styles.twoColumns}>
              <label className={styles.field}>Företagsnamn *<input autoComplete="organization" className={styles.input} name="companyName" minLength={2} maxLength={120} required /></label>
              <label className={styles.field}>Organisationsnummer *<input className={styles.input} inputMode="numeric" name="organizationNumber" minLength={6} maxLength={32} required /></label>
              <label className={styles.field}>Kontaktperson *<input autoComplete="name" className={styles.input} name="contactPerson" minLength={2} maxLength={120} required /></label>
              <label className={styles.field}>E-post *<input autoComplete="email" className={styles.input} name="email" required type="email" /></label>
              <label className={styles.field}>Telefon *<input autoComplete="tel" className={styles.input} name="phone" minLength={6} maxLength={40} required type="tel" /></label>
              <label className={styles.field}>Ort *<input autoComplete="address-level2" className={styles.input} name="city" minLength={2} maxLength={120} required /></label>
            </div>
            <label className={styles.field}>Var arbetar ni? *<input className={styles.input} name="serviceAreas" minLength={2} maxLength={300} placeholder="Till exempel Malmö och Lund" required /></label>
            <label className={styles.field}>Vilka tjänster erbjuder ni? *<input className={styles.input} name="services" minLength={2} maxLength={300} placeholder="Till exempel elinstallation och service" required /></label>
            <label className={styles.field}>Vad vill ni förbättra? *<textarea aria-describedby="description-help" className={styles.textarea} name="description" minLength={20} maxLength={2000} placeholder="Berätta kort om ert kundflöde eller vad du vill se i demon." required /><span id="description-help" className={styles.help}>Skriv minst 20 tecken.</span></label>
            <label className={styles.consent}><input name="consentAccepted" required type="checkbox" /><span>Jag godkänner att Proffera kontaktar mig om min demoförfrågan.</span></label>
            <button className={[styles.primaryButton, styles.fullButton].join(" ")} type="submit">Skicka demoförfrågan</button>
            <p className={styles.secureLine}>Vi skickar inte e-post automatiskt från formuläret.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
