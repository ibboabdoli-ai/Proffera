import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import styles from "@/app/remaining-public-experience.module.css";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "Thank you for your request",
  description: "Confirmation after sending a business registration request to Proffera.",
  englishPath: "/en/join-business/thank-you",
  swedishPath: "/anslut-foretag/tack",
});

type PageProps = { searchParams: Promise<{ ref?: string }> };

export default async function EnglishThanksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const reference = params.ref ?? "";
  const svHref = `/anslut-foretag/tack${reference ? `?ref=${encodeURIComponent(reference)}` : ""}`;

  return (
    <main className={styles.page} lang="en">
      <section className={[styles.shell, styles.narrow].join(" ")}>
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}><p className={styles.eyebrow}>Business</p><h1 className={styles.title}>Thank you! Your request has been received.</h1></div>
            <Link href={svHref} className={styles.languageLink}>Svenska</Link>
          </div>
        </header>
        <div className={styles.content}>
          <p className={styles.sectionCopy}>We have received your information and will contact you about the next step for a demo or installation.</p>
          {reference ? <p className={[styles.notice, styles.success].join(" ")}><CheckCircle2 className="mr-2 inline h-5 w-5" aria-hidden="true" />Reference number: {reference}</p> : null}
          <div className={styles.actions}><Link className={styles.primaryButton} href="/en">Back to home</Link><Link className={styles.secondaryButton} href="/en/join-business">New request</Link></div>
        </div>
      </section>
    </main>
  );
}
