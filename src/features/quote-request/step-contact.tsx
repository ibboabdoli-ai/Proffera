import { quoteFormCopy } from "./form-copy";
import type { QuoteFormStepProps } from "./step-props";

const ErrorText = ({ value }: { value?: string }) => value ? <p className="mt-2 text-sm font-medium text-red-700">{value}</p> : null;

export function QuoteContactStep({ locale, data, errors, update }: QuoteFormStepProps) {
  const t = quoteFormCopy[locale];
  return <div className="space-y-6">
    <div><label className="text-sm font-semibold" htmlFor="contactName">{t.name}</label><input id="contactName" value={data.contactName} onChange={(e) => update("contactName", e.target.value)} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3" /><ErrorText value={errors.contactName} /></div>
    <div className="grid gap-6 sm:grid-cols-2">
      <div><label className="text-sm font-semibold" htmlFor="contactEmail">{t.email}</label><input id="contactEmail" type="email" value={data.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3" /><ErrorText value={errors.contactEmail} /></div>
      <div><label className="text-sm font-semibold" htmlFor="contactPhone">{t.phone}</label><input id="contactPhone" value={data.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3" /><ErrorText value={errors.contactPhone} /></div>
    </div>
    <label className="flex gap-3 rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-4 text-sm leading-6 text-[#5b665f]"><input type="checkbox" checked={data.consentAccepted} onChange={(e) => update("consentAccepted", e.target.checked)} className="mt-1 h-4 w-4" /><span>{t.consent}</span></label>
    <ErrorText value={errors.consentAccepted} />
  </div>;
}
