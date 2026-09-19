import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";

export const metadata: Metadata = { title: "Tack för ansökan", description: "Bekräftelse efter företagsregistrering hos Proffera." };

type PageProps = { searchParams: Promise<{ ref?: string }> };

export default async function ThanksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const reference = params.ref ?? "";
  const enHref = `/en/join-business/thank-you${reference ? `?ref=${encodeURIComponent(reference)}` : ""}`;

  return (
    <main className={styles.page}>
      <section className={[styles.shell, styles.narrow].join(" ")}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}><p className={styles.eyebrow}>Företag</p><h1 className={styles.title}>Tack! Ansökan är mottagen.</h1></div>
            <Link href={enHref} className={styles.languageLink}>English</Link>
          </div>
        </header>
        <div className={styles.content}>
          <p className={styles.sectionCopy}>Vi har tagit emot uppgifterna och återkommer om nästa steg för demo eller installation.</p>
          {reference ? <p className={[styles.notice, styles.success].join(" ")}><CheckCircle2 className="mr-2 inline h-5 w-5" aria-hidden="true" />Referensnummer: {reference}</p> : null}
          <div className={styles.actions}><Link className={styles.primaryButton} href="/">Till startsidan</Link><Link className={styles.secondaryButton} href="/anslut-foretag">Ny förfrågan</Link></div>
        </div>
      </section>
    </main>
  );
}
