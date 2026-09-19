import { ShieldCheck, Sparkles, Target } from "lucide-react";

import styles from "@/components/marketing/platform-marketing.module.css";
import { ButtonLink } from "@/components/ui/button-link";
import { createEnglishMetadata } from "@/lib/english-metadata";

export const metadata = createEnglishMetadata({
  title: "About Proffera",
  description: "Proffera is developing a clearer digital workflow for Swedish service businesses to manage leads, bookings and customers.",
  englishPath: "/en/about",
  swedishPath: "/om",
});

const values = [
  { icon: Target, title: "Built for small businesses", text: "Proffera focuses on everyday needs: leads, bookings, customers and follow-up." },
  { icon: Sparkles, title: "Modules with clear status", text: "Planned features are marked as planned and are not automatically enabled for customer workspaces." },
  { icon: ShieldCheck, title: "A clear Swedish process", text: "The platform is developed step by step with a focus on safety, clarity and local service businesses." },
];

export default function EnglishAboutPage() {
  return (
    <main className={styles.page} lang="en">
      <section className={styles.hero}>
        <div className={styles.inner}>
          <p className={styles.eyebrow}>About Proffera</p>
          <h1 className={styles.title}>A clearer way for local service businesses to meet customers digitally.</h1>
          <p className={styles.lead}>
            Proffera started as a lead and quote workflow and is evolving step by step into a connected marketplace and workspace for service businesses in Sweden.
          </p>
        </div>
      </section>

      <section className={styles.sectionWhite}>
        <div className={styles.compactInner}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Our focus</p>
              <h2 className={styles.sectionTitle}>Practical workflows before decorative features.</h2>
            </div>
            <p className={styles.sectionLead}>We build around real customer jobs, clear data and controlled rollout of new capabilities.</p>
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
            <h2>Want to see how Proffera fits your customer workflow?</h2>
            <p>We only present capabilities and flows that already exist or are clearly marked as planned.</p>
            <div className={styles.actions}>
              <ButtonLink href="/en/contact">Talk to us</ButtonLink>
              <ButtonLink href="/en/demo" variant="secondary">View demo</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
