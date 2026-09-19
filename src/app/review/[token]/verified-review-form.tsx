"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Star } from "lucide-react";

import styles from "@/app/public-customer-lifecycle.module.css";
import { emitMarketplaceFunnelEvent } from "@/components/analytics/marketplace-funnel-signal";

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
    invalidSubmission: "Kontrollera formuläret och försök igen.",
    rateLimited: "För många försök. Vänta en stund och försök igen.",
    linkUnavailable: "Omdömeslänken kan inte användas längre.",
    reviewUnavailable: "Omdömet kan inte skickas i det här läget.",
    temporaryFailure: "Omdömet kunde inte sparas just nu. Försök igen senare.",
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
    invalidSubmission: "Check the form and try again.",
    rateLimited: "Too many attempts. Wait a while and try again.",
    linkUnavailable: "This review link can no longer be used.",
    reviewUnavailable: "This review cannot be submitted in its current state.",
    temporaryFailure: "The review could not be saved right now. Please try again later.",
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
      const response = await fetch("/api/reviews/" + encodeURIComponent(token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const localizedError =
          response.status === 400
            ? text.invalidSubmission
            : response.status === 404
              ? text.linkUnavailable
              : response.status === 409
                ? text.reviewUnavailable
                : response.status === 429
                  ? text.rateLimited
                  : response.status === 503
                    ? text.temporaryFailure
                    : text.submitError;
        throw new Error(localizedError);
      }

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
    <form onSubmit={submitReview} className={styles.reviewForm}>
      <div aria-hidden="true" className={styles.honeypot}>
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={styles.reviewSummary} style={{ borderLeftColor: primaryColor }}>
        <p className={styles.panelTitle}>{service}</p>
        {area ? <p className={styles.sectionCopy}>{area}</p> : null}
        <p className={styles.verifiedLabel} style={{ marginTop: "0.65rem" }}>{text.verified}</p>
      </div>

      <fieldset disabled={submitted}>
        <legend className={styles.formLabel}>
          {text.rating} <span aria-hidden="true">*</span>
        </legend>
        <div className={styles.starRow} role="group" aria-label={text.rating}>
          {[1, 2, 3, 4, 5].map((value) => {
            const active = rating >= value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-pressed={rating === value}
                aria-label={value + " " + text.stars}
                className={styles.starButton}
                style={{
                  borderColor: active ? "#1469d8" : "#bdc9d8",
                  color: active ? "#1469d8" : "#8b98aa",
                  backgroundColor: active ? "#f2f7fd" : "#ffffff",
                }}
              >
                <Star className="h-5 w-5" fill="currentColor" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className={styles.field}>
        {text.name} <span aria-hidden="true">*</span>
        <input
          name="reviewer_name"
          required
          autoComplete="name"
          maxLength={80}
          defaultValue={customerName === "Customer" ? "" : customerName}
          disabled={submitted}
          className={styles.input}
        />
      </label>

      <label className={styles.field}>
        {text.experience} <span aria-hidden="true">*</span>
        <textarea
          name="message"
          required
          rows={6}
          minLength={10}
          maxLength={1_000}
          disabled={submitted}
          className={styles.textarea}
          placeholder={text.placeholder}
        />
      </label>

      <label className={styles.consent}>
        <input
          name="consent"
          value="true"
          required
          type="checkbox"
          disabled={submitted}
        />
        <span>{text.consent.replace("företaget", companyName).replace("the company", companyName)}</span>
      </label>

      {submissionMessage ? (
        <p
          className={submissionMessage.kind === "error" ? styles.messageError : styles.messageSuccess}
          role={submissionMessage.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {submissionMessage.kind === "error" ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          {submissionMessage.text}
        </p>
      ) : null}

      <button type="submit" disabled={isSubmitting || submitted} className={styles.submitButton}>
        {isSubmitting ? (
          <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : submitted ? (
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Star className="h-5 w-5" aria-hidden="true" />
        )}
        {isSubmitting ? text.submitting : submitted ? text.submitted : text.submit}
      </button>
    </form>
  );
}
