import { quoteFormCopy } from "./form-copy";
import { quoteCategoryLabel, quoteServiceTypeLabel } from "./localization";
import styles from "./quote-request-marketplace.module.css";
import { serviceTypesByCategory } from "./schema";
import type { QuoteFormStepProps } from "./step-props";

function ErrorText({ value }: { value?: string }) {
  return value ? <p className={styles.errorText}>{value}</p> : null;
}

export function QuoteServiceStep({ locale, data, errors, update }: QuoteFormStepProps) {
  const t = quoteFormCopy[locale];
  const services = data.category && Object.hasOwn(serviceTypesByCategory, data.category)
    ? serviceTypesByCategory[data.category as keyof typeof serviceTypesByCategory]
    : [];

  return <div className={styles.stack}>
    <div className={styles.fieldGroup}>
      <label className={styles.label} htmlFor="category">{t.category}</label>
      <select id="category" value={data.category} onChange={(event) => update("category", event.target.value)} className={styles.select}>
        <option value="">{t.chooseCategory}</option>
        {Object.keys(serviceTypesByCategory).map((value) => <option key={value} value={value}>{quoteCategoryLabel(value, locale)}</option>)}
      </select>
      <ErrorText value={errors.category} />
    </div>
    <div className={styles.fieldGroup}>
      <label className={styles.label} htmlFor="serviceType">{t.service}</label>
      <select id="serviceType" value={data.serviceType} onChange={(event) => update("serviceType", event.target.value)} disabled={!data.category} className={styles.select}>
        <option value="">{t.chooseService}</option>
        {services.map((value) => <option key={value} value={value}>{quoteServiceTypeLabel(value, locale)}</option>)}
      </select>
      <ErrorText value={errors.serviceType} />
    </div>
  </div>;
}
