"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Star } from "lucide-react";

import { emitMarketplaceFunnelEvent } from "@/components/analytics/marketplace-funnel-signal";
import lifecycleStyles from "@/components/customer-lifecycle/customer-lifecycle.module.css";

type VerifiedReviewFormProps = {
  token: string;
  customerName: string;
  service: string;
  area: string | null;
  companyName: string;
  language: "sv" | "en";
  primaryColor: string;
};

type SubmissionMessage = { kind: "success" | "error"; text: string } | null;

const copy = {
  sv: {
    chooseRating: "Välj ett stjärnbetyg innan du skickar omdömet.",
    submitError: "Omdömet kunde inte skickas. Försök igen.",
    success: "Tack. Ditt verifierade omdöme har tagits emot och visas efter godkännande.",
    verified: "Verifierad slutförd tjänst",
    rating: "Ditt betyg",
    name: "Ditt namn",
    experience: "Berätta om din upplevelse",
    placeholder: "Vad gjorde företaget bra?",
    consent: "Jag godkänner att företaget publicerar mitt namn, betyg, tjänsteuppgifter och omdöme på sin webbplats.",
    submitting: "Skickar omdömet...",
    submitted: "Omdömet skickat",
    submit: "Skicka verifierat omdöme",
    stars: "av 5 stjärnor",
  },
  en: {
    chooseRating: "Please choose a star rating before submitting your review.",
    submitError: "We couldn't submit your review. Please try again.",
    success: "Thank you. Your verified review was received and will appear after approval.",
    verified: "Verified completed service",
    rating: "Your rating",
    name: "Your name",
    experience: "Tell us about your experience",
    placeholder: "What did the company do well?",
    consent: "I agree that the company may publish my name, rating, service details and review on its website.",
    submitting: "Submitting review...",
    submitted: "Review submitted",
    submit: "Submit verified review",
    stars: "out of 5 stars",
  },
} as const;

export function VerifiedReviewForm({
  token,
  customerName,
  service,
  area,
  companyName,
  language,
  primaryColor,
}: VerifiedReviewFormProps) {
  const text = copy[language];
  const formStartedAtRef = useRef<number | null>(null);
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<SubmissionMessage>(null);

  useEffect(() => {
    formStartedAtRef.current = Date.now();
  }, []);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || submitted) return;
    if (!rating) {
      setSubmissionMessage({ kind: "error", text: text.chooseRating });
      return;
    }

    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      reviewerName: String(values.get("reviewer_name") ?? ""),
      rating,
      message: String(values.get("message") ?? ""),
      consent: values.get("consent") === "true",
      website: String(values.get("website") ?? ""),
      formStartedAt: formStartedAtRef.current ?? Date.now(),
    };

    setIsSubmitting(true);
    setSubmissionMessage(null);
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? text.submitError);

      emitMarketplaceFunnelEvent({
        event: "marketplace_verified_review_submitted",
        properties: { locale: language },
      });
      form.reset();
      setRating(0);
      setSubmitted(true);
      setSubmissionMessage({ kind: "success", text: text.success });
    } catch (error) {
      setSubmissionMessage({
        kind: "error",
        text: error instanceof Error ? error.message : text.submitError,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitReview} className={lifecycleStyles.formStack}>
      <div aria-hidden="true" className="pointer-events-none absolute -left-[10000px] top-auto size-px overflow-hidden">
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={lifecycleStyles.reviewMeta}>
        <strong>{service}</strong>
        {area ? <p>{area}</p> : null}
        <p style={{ color: primaryColor }}>{text.verified}</p>
      </div>

      <fieldset disabled={submitted}>
        <legend className={lifecycleStyles.label}>
          {text.rating} <span className="text-red-700">*</span>
        </legend>
        <div className={lifecycleStyles.ratingRow} role="group" aria-label={text.rating}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
              aria-label={`${value} ${text.stars}`}
              className={lifecycleStyles.starButton}
              style={{
                borderColor: rating >= value ? primaryColor : "#dce4ee",
                color: rating >= value ? primaryColor : "#94a3b8",
              }}
            >
              <Star className="h-5 w-5" fill="currentColor" aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>

      <label className={lifecycleStyles.label}>
        {text.name} <span className="text-red-700">*</span>
        <input
          name="reviewer_name"
          required
          autoComplete="name"
          maxLength={80}
          defaultValue={customerName === "Customer" ? "" : customerName}
          disabled={submitted}
          className={lifecycleStyles.inputControl}
        />
      </label>

      <label className={lifecycleStyles.label}>
        {text.experience} <span className="text-red-700">*</span>
        <textarea
          name="message"
          required
          rows={6}
          minLength={10}
          maxLength={1_000}
          disabled={submitted}
          className={lifecycleStyles.textareaControl}
          placeholder={text.placeholder}
        />
      </label>

      <label className={lifecycleStyles.consent}>
        <input
          name="consent"
          value="true"
          required
          type="checkbox"
          disabled={submitted}
          style={{ accentColor: primaryColor }}
        />
        <span>{text.consent.replace("företaget", companyName).replace("the company", companyName)}</span>
      </label>

      {submissionMessage ? (
        <p
          className={submissionMessage.kind === "error" ? lifecycleStyles.noticeError : lifecycleStyles.noticeSuccess}
          role={submissionMessage.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {submissionMessage.kind === "error" ? (
            <AlertCircle className="mr-2 inline h-4 w-4" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />
          )}
          {submissionMessage.text}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || submitted}
        className={lifecycleStyles.submit}
        style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
      >
        {isSubmitting ? (
          <LoaderCircle className="mr-2 inline h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : submitted ? (
          <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />
        ) : (
          <Star className="mr-2 inline h-4 w-4" aria-hidden="true" />
        )}
        {isSubmitting ? text.submitting : submitted ? text.submitted : text.submit}
      </button>
    </form>
  );
}
