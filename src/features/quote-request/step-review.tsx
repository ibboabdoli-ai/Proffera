import { quoteFormCopy } from "./form-copy";
import { quoteCategoryLabel, quotePreferredDateLabel, quoteServiceTypeLabel } from "./localization";
import styles from "./quote-request-marketplace.module.css";
import { getSmartQuoteAnswerSummary, type SmartQuoteAnswers } from "./smart-quote-questions";
import type { QuoteFormStepProps } from "./step-props";

export function QuoteReviewStep({ locale, data, smartAnswers }: QuoteFormStepProps & { smartAnswers: SmartQuoteAnswers }) {
  const t = quoteFormCopy[locale];
  const locationValue = data.locationSource === "geolocation" ? t.nearMeSaved : data.addressLine1;
  const rows = [
    [t.category, quoteCategoryLabel(data.category, locale)],
    [t.service, quoteServiceTypeLabel(data.serviceType, locale)],
    [t.locationMethod, locationValue],
    [t.city, data.city],
    [t.postal, data.postalCode],
    [t.date, quotePreferredDateLabel(data.preferredDate, locale)],
    [t.name, data.contactName],
    [t.email, data.contactEmail],
    [t.phone, data.contactPhone],
  ];
  const smartRows = getSmartQuoteAnswerSummary(data.category, data.serviceType, locale, smartAnswers);

  return <div className={styles.reviewStack}>
    {rows.map(([label, value]) => (
      <dl key={label} className={styles.reviewCard}>
        <dt>{label}</dt>
        <dd>{value || t.missing}</dd>
      </dl>
    ))}

    {smartRows.length > 0 ? <div className={styles.reviewCard}>
      <p className={styles.reviewLabel}>{t.structuredDetails}</p>
      <dl className={styles.reviewGrid}>
        {smartRows.map((item) => (
          <div key={item.id}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div> : null}

    <div className={styles.reviewCard}>
      <p className={styles.reviewLabel}>{t.description}</p>
      <p className={styles.reviewValue}>{data.description || t.missing}</p>
    </div>
  </div>;
}
