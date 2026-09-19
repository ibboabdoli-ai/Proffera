import { quoteFormCopy } from "./form-copy";
import styles from "./quote-request-marketplace.module.css";
import type { QuoteFormStepProps } from "./step-props";

const ErrorText = ({ value }: { value?: string }) => value ? <p className={styles.errorText}>{value}</p> : null;

export function QuoteContactStep({ locale, data, errors, update }: QuoteFormStepProps) {
  const t = quoteFormCopy[locale];
  return <div className={styles.stack}>
    <div className={styles.fieldGroup}>
      <label className={styles.label} htmlFor="contactName">{t.name}</label>
      <input id="contactName" value={data.contactName} onChange={(event) => update("contactName", event.target.value)} className={styles.input} />
      <ErrorText value={errors.contactName} />
    </div>

    <div className={styles.twoCol}>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="contactEmail">{t.email}</label>
        <input id="contactEmail" type="email" value={data.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} className={styles.input} />
        <ErrorText value={errors.contactEmail} />
      </div>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="contactPhone">{t.phone}</label>
        <input id="contactPhone" value={data.contactPhone} onChange={(event) => update("contactPhone", event.target.value)} className={styles.input} />
        <ErrorText value={errors.contactPhone} />
      </div>
    </div>

    <label className={styles.consentBox}>
      <input type="checkbox" checked={data.consentAccepted} onChange={(event) => update("consentAccepted", event.target.checked)} />
      <span>{t.consent}</span>
    </label>
    <ErrorText value={errors.consentAccepted} />
  </div>;
}
