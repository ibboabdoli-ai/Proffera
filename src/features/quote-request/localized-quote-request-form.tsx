"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";

import type { PublicLocale } from "@/lib/public-locale";
import { submitQuoteRequest } from "./actions";
import { quoteFormCopy } from "./form-copy";
import { createQuoteRequestSchema, initialQuoteRequest, sanitizeQuoteRequestPrefill, type QuoteRequestErrors, type QuoteRequestField, type QuoteRequestInput, type QuoteRequestPrefill } from "./schema";
import { QuoteContactStep } from "./step-contact";
import { QuoteDescriptionStep } from "./step-description";
import { QuoteLocationStep } from "./step-location";
import { QuoteReviewStep } from "./step-review";
import { QuoteServiceStep } from "./step-service";

const stepFields: Record<number, QuoteRequestField[]> = {
  0: ["category", "serviceType"],
  1: ["city", "postalCode"],
  2: ["description", "preferredDate"],
  3: ["contactName", "contactEmail", "contactPhone", "consentAccepted"],
  4: [],
};

export function LocalizedQuoteRequestForm({ locale, initialValues }: { locale: PublicLocale; initialValues?: QuoteRequestPrefill }) {
  const t = quoteFormCopy[locale];
  const [step, setStep] = useState(0);
  const [data, setData] = useState<QuoteRequestInput>(() => ({
    ...initialQuoteRequest,
    ...sanitizeQuoteRequestPrefill(initialValues),
  }));
  const [website, setWebsite] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [errors, setErrors] = useState<QuoteRequestErrors>({});
  const [reference, setReference] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const progress = Math.round(((step + 1) / t.steps.length) * 100);

  function update<Field extends QuoteRequestField>(field: Field, value: QuoteRequestInput[Field]) {
    setData((current) => ({ ...current, [field]: value, ...(field === "category" ? { serviceType: "" } : {}) }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  function validate(input: QuoteRequestInput) {
    const parsed = createQuoteRequestSchema(locale).safeParse(input);
    if (parsed.success) return {};
    return parsed.error.issues.reduce<QuoteRequestErrors>((output, issue) => {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in output)) output[field as QuoteRequestField] = issue.message;
      return output;
    }, {});
  }

  function goNext() {
    const allErrors = validate(data);
    const currentErrors = (stepFields[step] ?? []).reduce<QuoteRequestErrors>((output, field) => {
      if (allErrors[field]) output[field] = allErrors[field];
      return output;
    }, {});
    setErrors((current) => ({ ...current, ...currentErrors }));
    if (Object.keys(currentErrors).length === 0) setStep((current) => Math.min(current + 1, t.steps.length - 1));
  }

  function handleSubmit() {
    const allErrors = validate(data);
    if (Object.keys(allErrors).length > 0) { setErrors(allErrors); return; }
    startTransition(() => {
      void submitQuoteRequest({ ...data, website, formStartedAt: startedAt }).then((result) => {
        if (!result.ok) {
          if (locale === "en") {
            const localizedErrors = validate(data);
            setErrors(Object.keys(localizedErrors).length > 0 ? localizedErrors : { form: t.serverError });
          } else {
            setErrors(result.errors);
          }
          return;
        }
        setReference(result.referenceId);
        setErrors({});
      });
    });
  }

  if (reference) return <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dfe5dd]">
    <CheckCircle2 className="h-12 w-12 text-[#17452f]" aria-hidden="true" />
    <h2 className="mt-5 text-2xl font-bold text-[#17201a]">{t.sent}</h2>
    <p className="mt-3 text-[#5b665f]">{t.sentText}</p>
    <div className="mt-6 rounded-2xl bg-[#eef5ef] p-4 text-sm font-semibold text-[#17452f]">{t.reference}: {reference}</div>
  </div>;

  const stepProps = { locale, data, errors, update };

  return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd] sm:p-8">
    <label className="absolute left-[-10000px]" aria-hidden="true">{t.website}<input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
    <div className="mb-8">
      <div className="flex items-center justify-between gap-4 text-sm font-semibold text-[#17452f]"><span>{t.step} {step + 1} {t.of} {t.steps.length}</span><span>{progress}%</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8eee8]"><div className="h-full rounded-full bg-[#17452f] transition-all" style={{ width: `${progress}%` }} /></div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#5b665f]">{t.steps.map((label, index) => <span key={label} className={`rounded-full px-3 py-1 ${index === step ? "bg-[#17452f] text-white" : "bg-[#f1f4f0]"}`}>{label}</span>)}</div>
    </div>
    {errors.form ? <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{errors.form}</div> : null}
    {step === 0 ? <QuoteServiceStep {...stepProps} /> : null}
    {step === 1 ? <QuoteLocationStep {...stepProps} /> : null}
    {step === 2 ? <QuoteDescriptionStep {...stepProps} /> : null}
    {step === 3 ? <QuoteContactStep {...stepProps} /> : null}
    {step === 4 ? <QuoteReviewStep {...stepProps} /> : null}
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#dfe5dd] pt-6 sm:flex-row sm:justify-between">
      <button type="button" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0 || pending} className="rounded-full border border-[#dfe5dd] px-5 py-3 text-sm font-semibold text-[#17452f] disabled:opacity-50">{t.back}</button>
      {step < t.steps.length - 1 ? <button type="button" onClick={goNext} className="rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0e2e1e]">{t.next}</button> : <button type="button" onClick={handleSubmit} disabled={pending} className="rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0e2e1e] disabled:opacity-60">{pending ? t.sending : t.submit}</button>}
    </div>
  </div>;
}
