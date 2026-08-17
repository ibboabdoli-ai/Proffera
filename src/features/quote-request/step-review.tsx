import { quoteFormCopy } from "./form-copy";
import { quoteCategoryLabel, quotePreferredDateLabel, quoteServiceTypeLabel } from "./localization";
import { getSmartQuoteAnswerSummary, type SmartQuoteAnswers } from "./smart-quote-questions";
import type { QuoteFormStepProps } from "./step-props";

export function QuoteReviewStep({ locale, data, smartAnswers }: QuoteFormStepProps & { smartAnswers: SmartQuoteAnswers }) {
  const t = quoteFormCopy[locale];
  const rows = [[t.category, quoteCategoryLabel(data.category, locale)], [t.service, quoteServiceTypeLabel(data.serviceType, locale)], [t.city, data.city], [t.postal, data.postalCode], [t.date, quotePreferredDateLabel(data.preferredDate, locale)], [t.name, data.contactName], [t.email, data.contactEmail], [t.phone, data.contactPhone]];
  const smartRows = getSmartQuoteAnswerSummary(data.category, data.serviceType, locale, smartAnswers);

  return <div className="space-y-4">
    {rows.map(([label, value]) => <div key={label} className="rounded-2xl border border-[#dfe5dd] p-4"><p className="text-xs font-semibold uppercase text-[#5b665f]">{label}</p><p className="mt-1 font-semibold">{value || t.missing}</p></div>)}
    {smartRows.length > 0 ? <div className="rounded-2xl border border-[#dfe5dd] p-4">
      <p className="text-xs font-semibold uppercase text-[#5b665f]">{t.structuredDetails}</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {smartRows.map((item) => <div key={item.id}><dt className="text-xs font-semibold text-[#5b665f]">{item.label}</dt><dd className="mt-1 font-semibold text-[#17201a]">{item.value}</dd></div>)}
      </dl>
    </div> : null}
    <div className="rounded-2xl border border-[#dfe5dd] p-4"><p className="text-xs font-semibold uppercase text-[#5b665f]">{t.description}</p><p className="mt-1 whitespace-pre-wrap">{data.description || t.missing}</p></div>
  </div>;
}
