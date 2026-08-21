"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import type { PublicLocale } from "@/lib/public-locale";
import { submitQuoteRequest } from "./actions";
import { quoteFormCopy } from "./form-copy";
import { createQuoteRequestSchema, initialQuoteRequest, sanitizeQuoteRequestPrefill, type QuoteRequestErrors, type QuoteRequestField, type QuoteRequestInput, type QuoteRequestPrefill } from "./schema";
import { buildSmartQuoteDescription, getSmartQuoteQuestions, validateSmartQuoteAnswers, type SmartQuoteAnswers } from "./smart-quote-questions";
import { QuoteContactStep } from "./step-contact";
import { QuoteDescriptionStep } from "./step-description";
import { QuoteLocationStep } from "./step-location";
import { QuoteReviewStep } from "./step-review";
import { QuoteServiceStep } from "./step-service";
import { QuoteSmartDetailsStep } from "./step-smart-details";

const DRAFT_STORAGE_KEY = "proffera:quote-request:language-draft:v1";
const DRAFT_MAX_AGE_MS = 30 * 60 * 1000;

const stepFields: Record<number, QuoteRequestField[]> = {
  0: ["category", "serviceType"],
  1: [],
  2: ["addressLine1", "city", "postalCode"],
  3: ["description", "preferredDate"],
  4: ["contactName", "contactEmail", "contactPhone", "consentAccepted"],
  5: [],
};

type QuoteLanguageDraft = {
  savedAt: number;
  data: Partial<QuoteRequestInput>;
  smartAnswers: SmartQuoteAnswers;
  step: number;
};

function restoreDraftData(current: QuoteRequestInput, value: unknown): QuoteRequestInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return current;
  const draft = value as Record<string, unknown>;
  const restored = { ...current };

  for (const field of ["category", "serviceType", "addressLine1", "city", "postalCode", "description", "preferredDate", "contactName", "contactEmail", "contactPhone"] as const) {
    const value = draft[field];
    if (typeof value === "string") restored[field] = value;
  }
  if (draft.locationSource === "address" || draft.locationSource === "geolocation") restored.locationSource = draft.locationSource;
  if (draft.latitude === null || typeof draft.latitude === "number") restored.latitude = draft.latitude;
  if (draft.longitude === null || typeof draft.longitude === "number") restored.longitude = draft.longitude;
  if (typeof draft.consentAccepted === "boolean") restored.consentAccepted = draft.consentAccepted;

  return restored;
}

function restoreSmartAnswers(value: unknown): SmartQuoteAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, answer]) => [key.slice(0, 120), answer.slice(0, 500)]),
  );
}

export function LocalizedQuoteRequestForm({
  locale,
  initialValues,
  alternateLocaleHref,
  alternateLocaleLabel,
}: {
  locale: PublicLocale;
  initialValues?: QuoteRequestPrefill;
  alternateLocaleHref?: string;
  alternateLocaleLabel?: string;
}) {
  const t = quoteFormCopy[locale];
  const [step, setStep] = useState(0);
  const [data, setData] = useState<QuoteRequestInput>(() => ({
    ...initialQuoteRequest,
    ...sanitizeQuoteRequestPrefill(initialValues),
  }));
  const [smartAnswers, setSmartAnswers] = useState<SmartQuoteAnswers>({});
  const [smartErrors, setSmartErrors] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [errors, setErrors] = useState<QuoteRequestErrors>({});
  const [reference, setReference] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const progress = Math.round(((step + 1) / t.steps.length) * 100);
  const smartQuestions = getSmartQuoteQuestions(data.category, data.serviceType, locale);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "1") return;

    try {
      const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<QuoteLanguageDraft>;
      const savedAt = Number(draft.savedAt);
      if (!Number.isFinite(savedAt) || Date.now() - savedAt > DRAFT_MAX_AGE_MS) return;

      setData((current) => restoreDraftData(current, draft.data));
      setSmartAnswers(restoreSmartAnswers(draft.smartAnswers));
      if (typeof draft.step === "number" && Number.isInteger(draft.step)) {
        setStep(Math.max(0, Math.min(t.steps.length - 1, draft.step)));
      }
    } catch {
      // A malformed or blocked sessionStorage draft must never block the quote form.
    } finally {
      try {
        window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Ignore storage failures and keep the form usable.
      }
    }
  }, [t.steps.length]);

  function update<Field extends QuoteRequestField>(field: Field, value: QuoteRequestInput[Field]) {
    setData((current) => ({ ...current, [field]: value, ...(field === "category" ? { serviceType: "" } : {}) }));
    if (field === "category" || field === "serviceType") {
      setSmartAnswers({});
      setSmartErrors({});
    }
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  function updateSmartAnswer(questionId: string, value: string) {
    setSmartAnswers((current) => ({ ...current, [questionId]: value }));
    setSmartErrors((current) => ({ ...current, [questionId]: "" }));
    setErrors((current) => ({ ...current, form: undefined }));
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
    if (step === 1) {
      const detailErrors = validateSmartQuoteAnswers(smartQuestions, smartAnswers, locale);
      setSmartErrors(detailErrors);
      if (Object.keys(detailErrors).length === 0) setStep(2);
      return;
    }

    const allErrors = validate(data);
    const currentErrors = (stepFields[step] ?? []).reduce<QuoteRequestErrors>((output, field) => {
      if (allErrors[field]) output[field] = allErrors[field];
      return output;
    }, {});
    setErrors((current) => ({ ...current, ...currentErrors }));
    if (Object.keys(currentErrors).length === 0) setStep((current) => Math.min(current + 1, t.steps.length - 1));
  }

  function switchLanguage() {
    if (!alternateLocaleHref) return;

    try {
      const draft: QuoteLanguageDraft = { savedAt: Date.now(), data, smartAnswers, step };
      window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Continue to the other locale even when storage is unavailable.
    }
    window.location.assign(alternateLocaleHref);
  }

  function handleSubmit() {
    const detailErrors = validateSmartQuoteAnswers(smartQuestions, smartAnswers, locale);
    if (Object.keys(detailErrors).length > 0) {
      setSmartErrors(detailErrors);
      setStep(1);
      return;
    }

    const compiledDescription = buildSmartQuoteDescription(data.category, data.serviceType, locale, smartAnswers, data.description);
    if (compiledDescription.length > 2_000) {
      setErrors((current) => ({ ...current, form: t.descriptionTooLong }));
      setStep(3);
      return;
    }

    const submissionData = { ...data, description: compiledDescription };
    const allErrors = validate(submissionData);
    if (Object.keys(allErrors).length > 0) { setErrors(allErrors); return; }
    startTransition(() => {
      void submitQuoteRequest({ ...submissionData, website, formStartedAt: startedAt }).then((result) => {
        if (!result.ok) {
          if (locale === "en") {
            const localizedErrors = validate(submissionData);
            setErrors(Object.keys(localizedErrors).length > 0 ? localizedErrors : { form: t.serverError });
          } else {
            setErrors(result.errors);
          }
          return;
        }
        try {
          window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {
          // Ignore storage failures after a successful request.
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
    {alternateLocaleHref && alternateLocaleLabel ? <div className="mb-5 flex justify-end">
      <button type="button" onClick={switchLanguage} className="rounded-full border border-[#dfe5dd] bg-white px-4 py-2 text-sm font-semibold text-[#17452f] transition hover:bg-[#f4f8f4]">{alternateLocaleLabel}</button>
    </div> : null}
    <div className="mb-8">
      <div className="flex items-center justify-between gap-4 text-sm font-semibold text-[#17452f]"><span>{t.step} {step + 1} {t.of} {t.steps.length}</span><span>{progress}%</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8eee8]"><div className="h-full rounded-full bg-[#17452f] transition-all" style={{ width: `${progress}%` }} /></div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#5b665f]">{t.steps.map((label, index) => <span key={label} className={`rounded-full px-3 py-1 ${index === step ? "bg-[#17452f] text-white" : "bg-[#f1f4f0]"}`}>{label}</span>)}</div>
    </div>
    {errors.form ? <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{errors.form}</div> : null}
    {step === 0 ? <QuoteServiceStep {...stepProps} /> : null}
    {step === 1 ? <QuoteSmartDetailsStep locale={locale} questions={smartQuestions} answers={smartAnswers} errors={smartErrors} onChange={updateSmartAnswer} /> : null}
    {step === 2 ? <QuoteLocationStep {...stepProps} /> : null}
    {step === 3 ? <QuoteDescriptionStep {...stepProps} /> : null}
    {step === 4 ? <QuoteContactStep {...stepProps} /> : null}
    {step === 5 ? <QuoteReviewStep {...stepProps} smartAnswers={smartAnswers} /> : null}
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#dfe5dd] pt-6 sm:flex-row sm:justify-between">
      <button type="button" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0 || pending} className="rounded-full border border-[#dfe5dd] px-5 py-3 text-sm font-semibold text-[#17452f] disabled:opacity-50">{t.back}</button>
      {step < t.steps.length - 1 ? <button type="button" onClick={goNext} className="rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0e2e1e]">{t.next}</button> : <button type="button" onClick={handleSubmit} disabled={pending} className="rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0e2e1e] disabled:opacity-60">{pending ? t.sending : t.submit}</button>}
    </div>
  </div>;
}
