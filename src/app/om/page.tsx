import { ShieldCheck, Sparkles, Target } from "lucide-react";

import styles from "@/components/marketing/platform-marketing.module.css";
import { ButtonLink } from "@/components/ui/button-link";

const values = [
  { icon: Target, title: "Byggt för små företag", text: "Proffera fokuserar på vardagliga behov: leads, bokningar, kunder och uppföljning." },
  { icon: Sparkles, title: "Moduler med tydlig status", text: "Planerade funktioner markeras som planerade och aktiveras inte automatiskt för kunders arbetsytor." },
  { icon: ShieldCheck, title: "Svensk och tydlig process", text: "Plattformen byggs stegvis med fokus på säkerhet, tydlighet och lokala tjänsteföretag." },
];

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>Om Proffera</p>
          <h1 className={styles.title}>Ett tydligare sätt för lokala tjänsteföretag att möta kunder digitalt.</h1>
          <p className={styles.lead}>
            Proffera började som ett lead- och offertflöde och utvecklas stegvis till en sammanhängande marknadsplats och arbetsyta för svenska tjänsteföretag.
          </p>
        </div>
      </section>

      <section className={styles.sectionWhite}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Vårt fokus</p>
              <h2 className={styles.sectionTitle}>Praktiska flöden före dekorativa funktioner.</h2>
            </div>
            <p className={styles.sectionLead}>Vi bygger runt verkliga kundärenden, tydlig data och kontrollerad lansering av nya delar.</p>
          </div>

          <ul className={styles.valueList}>
            {values.map(({ icon: Icon, title, text }) => (
              <li key={title} className={styles.valueRow}>
                <h3 className={styles.valueTitle}><Icon aria-hidden="true" />{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.sectionSoft}>
        <div className={styles.compactInner}>
          <div className={styles.ctaBand}>
            <h2>Vill du se hur Proffera passar ditt kundflöde?</h2>
            <p>Vi visar bara funktioner och flöden som faktiskt finns eller är tydligt markerade som planerade.</p>
            <div className={styles.actions}>
              <ButtonLink href="/kontakt">Prata med oss</ButtonLink>
              <ButtonLink href="/demo" variant="secondary">Se demo</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
