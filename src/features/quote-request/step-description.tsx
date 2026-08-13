import { quoteFormCopy } from "./form-copy";
import { preferredDateValues, quotePreferredDateLabel } from "./localization";
import type { QuoteFormStepProps } from "./step-props";

function ErrorText({ value }: { value?: string }) {
  return value ? <p className="mt-2 text-sm font-medium text-red-700">{value}</p> : null;
}

export function QuoteDescriptionStep({ locale, data, errors, update }: QuoteFormStepProps) {
  const t = quoteFormCopy[locale];
  return <div className="space-y-6">
    <div>
      <label className="text-sm font-semibold text-[#17201a]" htmlFor="description">{t.description}</label>
      <textarea id="description" value={data.description} onChange={(event) => update("description", event.target.value)} rows={6} placeholder={t.descriptionHint} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]" />
      <ErrorText value={errors.description} />
    </div>
    <div>
      <label className="text-sm font-semibold text-[#17201a]" htmlFor="preferredDate">{t.date}</label>
      <select id="preferredDate" value={data.preferredDate} onChange={(event) => update("preferredDate", event.target.value)} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 outline-none focus:border-[#17452f]">
        <option value="">{t.chooseDate}</option>
        {preferredDateValues.map((value) => <option key={value} value={value}>{quotePreferredDateLabel(value, locale)}</option>)}
      </select>
      <ErrorText value={errors.preferredDate} />
    </div>
  </div>;
}
