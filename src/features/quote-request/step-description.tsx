import { quoteFormCopy } from "./form-copy";
import { preferredDateValues, quotePreferredDateLabel } from "./localization";
import styles from "./quote-request-marketplace.module.css";
import type { QuoteFormStepProps } from "./step-props";

function ErrorText({ id, value }: { id: string; value?: string }) {
  return value ? <p id={id} className={styles.errorText}>{value}</p> : null;
}

export function QuoteDescriptionStep({ locale, data, errors, update }: QuoteFormStepProps) {
  const t = quoteFormCopy[locale];
  return <div className={styles.stack}>
    <div className={styles.fieldGroup}>
      <label className={styles.label} htmlFor="description">{t.description}</label>
      <textarea
        id="description"
        value={data.description}
        onChange={(event) => update("description", event.target.value)}
        rows={6}
        placeholder={t.descriptionHint}
        className={styles.textarea}
        aria-invalid={errors.description ? true : undefined}
        aria-describedby={errors.description ? "quote-description-error" : undefined}
      />
      <ErrorText id="quote-description-error" value={errors.description} />
    </div>
    <div className={styles.fieldGroup}>
      <label className={styles.label} htmlFor="preferredDate">{t.date}</label>
      <select
        id="preferredDate"
        value={data.preferredDate}
        onChange={(event) => update("preferredDate", event.target.value)}
        className={styles.select}
        aria-invalid={errors.preferredDate ? true : undefined}
        aria-describedby={errors.preferredDate ? "quote-preferred-date-error" : undefined}
      >
        <option value="">{t.chooseDate}</option>
        {preferredDateValues.map((value) => <option key={value} value={value}>{quotePreferredDateLabel(value, locale)}</option>)}
      </select>
      <ErrorText id="quote-preferred-date-error" value={errors.preferredDate} />
    </div>
  </div>;
}
