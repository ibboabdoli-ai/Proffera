import { quoteFormCopy } from "./form-copy";
import { quoteCategoryLabel, quoteServiceTypeLabel } from "./localization";
import { serviceTypesByCategory } from "./schema";
import type { QuoteFormStepProps } from "./step-props";

function ErrorText({ value }: { value?: string }) {
  return value ? <p className="mt-2 text-sm font-medium text-red-700">{value}</p> : null;
}

export function QuoteServiceStep({ locale, data, errors, update }: QuoteFormStepProps) {
  const t = quoteFormCopy[locale];
  const services = data.category && Object.hasOwn(serviceTypesByCategory, data.category)
    ? serviceTypesByCategory[data.category as keyof typeof serviceTypesByCategory]
    : [];

  return <div className="space-y-6">
    <div>
      <label className="text-sm font-semibold text-[#17201a]" htmlFor="category">{t.category}</label>
      <select id="category" value={data.category} onChange={(event) => update("category", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 outline-none focus:border-[#17452f]">
        <option value="">{t.chooseCategory}</option>
        {Object.keys(serviceTypesByCategory).map((value) => <option key={value} value={value}>{quoteCategoryLabel(value, locale)}</option>)}
      </select>
      <ErrorText value={errors.category} />
    </div>
    <div>
      <label className="text-sm font-semibold text-[#17201a]" htmlFor="serviceType">{t.service}</label>
      <select id="serviceType" value={data.serviceType} onChange={(event) => update("serviceType", event.target.value)} disabled={!data.category} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 outline-none focus:border-[#17452f] disabled:bg-[#f1f4f0]">
        <option value="">{t.chooseService}</option>
        {services.map((value) => <option key={value} value={value}>{quoteServiceTypeLabel(value, locale)}</option>)}
      </select>
      <ErrorText value={errors.serviceType} />
    </div>
  </div>;
}
