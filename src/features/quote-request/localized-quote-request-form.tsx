"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { emitMarketplaceFunnelEvent } from "@/components/analytics/marketplace-funnel-signal";
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

import styles from "./quote-request-marketplace.module.css";

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

function discardLanguageDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Storage can be blocked; the quote form must remain usable.
  }
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
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const progress = Math.round(((step + 1) / t.steps.length) * 100);
  const smartQuestions = getSmartQuoteQuestions(data.category, data.serviceType, locale);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "1") return;

    let frameId: number | null = null;
    try {
      const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;

      let parsedDraft: unknown;
      try {
        parsedDraft = JSON.parse(raw) as unknown;
      } catch {
        discardLanguageDraft();
        return;
      }
      if (!parsedDraft || typeof parsedDraft !== "object" || Array.isArray(parsedDraft)) {
        discardLanguageDraft();
        return;
      }
      const draft = parsedDraft as Partial<QuoteLanguageDraft>;

      const savedAt = Number(draft.savedAt);
      const draftAge = Date.now() - savedAt;
      if (!Number.isFinite(savedAt) || draftAge < 0 || draftAge > DRAFT_MAX_AGE_MS) {
        discardLanguageDraft();
        return;
      }

      const restoredSmartAnswers = restoreSmartAnswers(draft.smartAnswers);
      const restoredStep = typeof draft.step === "number" && Number.isInteger(draft.step)
        ? Math.max(0, Math.min(t.steps.length - 1, draft.step))
        : null;

      frameId = window.requestAnimationFrame(() => {
        setData((current) => restoreDraftData(current, draft.data));
        setSmartAnswers(restoredSmartAnswers);
        if (restoredStep !== null) setStep(restoredStep);
        discardLanguageDraft();
      });
    } catch {
      // A blocked sessionStorage draft must never block the quote form.
    }

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
    };
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
    if (!alternateLocaleHref || submissionInFlight.current) return;

    try {
      const draft: QuoteLanguageDraft = { savedAt: Date.now(), data, smartAnswers, step };
      window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Continue to the other locale even when storage is unavailable.
    }
    window.location.assign(alternateLocaleHref);
  }

  function handleSubmit() {
    if (submissionInFlight.current) return;

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

    submissionInFlight.current = true;
    setSubmitting(true);
    startTransition(() => {
      void submitQuoteRequest({ ...submissionData, website, formStartedAt: startedAt })
        .then((result) => {
          if (!result.ok) {
            if (locale === "en") {
              const localizedErrors = validate(submissionData);
              setErrors(Object.keys(localizedErrors).length > 0 ? localizedErrors : { form: t.serverError });
            } else {
              setErrors(result.errors);
            }
            return;
          }
          discardLanguageDraft();
          emitMarketplaceFunnelEvent({ event: "marketplace_request_submitted", properties: { locale } });
          setReference(result.referenceId);
          setErrors({});
        })
        .finally(() => {
          submissionInFlight.current = false;
          setSubmitting(false);
        });
    });
  }

  if (reference) return <div className={styles.successCard}>
    <CheckCircle2 className={styles.successIcon} aria-hidden="true" />
    <h2>{t.sent}</h2>
    <p>{t.sentText}</p>
    <div className={styles.reference}>{t.reference}: {reference}</div>
  </div>;

  const stepProps = { locale, data, errors, update };
  const submissionPending = pending || submitting;

  return <div className={styles.formCard}>
    <label className="absolute left-[-10000px]" aria-hidden="true">{t.website}<input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
    {alternateLocaleHref && alternateLocaleLabel ? <div className={styles.languageRow}>
      <button type="button" onClick={switchLanguage} disabled={submissionPending} className={styles.languageButton}>{alternateLocaleLabel}</button>
    </div> : null}
    <div className={styles.progressHeader}>
      <div className={styles.progressMeta}><span>{t.step} {step + 1} {t.of} {t.steps.length}</span><span>{progress}%</span></div>
      <div className={styles.progressTrack}><div className={styles.progressBar} style={{ width: `${progress}%` }} /></div>
      <div className={styles.stepChips}>{t.steps.map((label, index) => <span key={label} className={`${styles.stepChip} ${index === step ? styles.stepChipActive : ""}`}>{label}</span>)}</div>
    </div>
    {errors.form ? <div className={styles.formError}>{errors.form}</div> : null}
    {step === 0 ? <QuoteServiceStep {...stepProps} /> : null}
    {step === 1 ? <QuoteSmartDetailsStep locale={locale} questions={smartQuestions} answers={smartAnswers} errors={smartErrors} onChange={updateSmartAnswer} /> : null}
    {step === 2 ? <QuoteLocationStep {...stepProps} /> : null}
    {step === 3 ? <QuoteDescriptionStep {...stepProps} /> : null}
    {step === 4 ? <QuoteContactStep {...stepProps} /> : null}
    {step === 5 ? <QuoteReviewStep {...stepProps} smartAnswers={smartAnswers} /> : null}
    <div className={styles.navRow}>
      <button type="button" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0 || submissionPending} className={styles.backButton}>{t.back}</button>
      {step < t.steps.length - 1
        ? <button type="button" onClick={goNext} className={styles.nextButton}>{t.next}</button>
        : <button type="button" onClick={handleSubmit} disabled={submissionPending} className={styles.nextButton}>{submissionPending ? t.sending : t.submit}</button>}
    </div>
  </div>;
}
