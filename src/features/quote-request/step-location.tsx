import { quoteFormCopy } from "./form-copy";
import type { QuoteFormStepProps } from "./step-props";

function ErrorText({ value }: { value?: string }) {
  return value ? <p className="mt-2 text-sm font-medium text-red-700">{value}</p> : null;
}

export function QuoteLocationStep({ locale, data, errors, update }: QuoteFormStepProps) {
  const t = quoteFormCopy[locale];
  return <div className="grid gap-6 sm:grid-cols-2">
    <div>
      <label className="text-sm font-semibold text-[#17201a]" htmlFor="city">{t.city}</label>
      <input id="city" value={data.city} onChange={(event) => update("city", event.target.value)} placeholder={t.cityHint} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]" />
      <ErrorText value={errors.city} />
    </div>
    <div>
      <label className="text-sm font-semibold text-[#17201a]" htmlFor="postalCode">{t.postal}</label>
      <input id="postalCode" value={data.postalCode} onChange={(event) => update("postalCode", event.target.value)} placeholder={t.postalHint} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]" />
      <ErrorText value={errors.postalCode} />
    </div>
  </div>;
}
