import { quoteFormCopy } from "./form-copy";
import { quoteCategoryLabel, quotePreferredDateLabel, quoteServiceTypeLabel } from "./localization";
import type { QuoteFormStepProps } from "./step-props";

export function QuoteReviewStep({ locale, data }: QuoteFormStepProps) {
  const t = quoteFormCopy[locale];
  const rows = [[t.category, quoteCategoryLabel(data.category, locale)], [t.service, quoteServiceTypeLabel(data.serviceType, locale)], [t.city, data.city], [t.postal, data.postalCode], [t.date, quotePreferredDateLabel(data.preferredDate, locale)], [t.name, data.contactName], [t.email, data.contactEmail], [t.phone, data.contactPhone]];
  return <div className="space-y-4">
    {rows.map(([label, value]) => <div key={label} className="rounded-2xl border border-[#dfe5dd] p-4"><p className="text-xs font-semibold uppercase text-[#5b665f]">{label}</p><p className="mt-1 font-semibold">{value || t.missing}</p></div>)}
    <div className="rounded-2xl border border-[#dfe5dd] p-4"><p className="text-xs font-semibold uppercase text-[#5b665f]">{t.description}</p><p className="mt-1">{data.description || t.missing}</p></div>
  </div>;
}
