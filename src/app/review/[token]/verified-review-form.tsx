"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Star } from "lucide-react";

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

const inputClassName =
  "rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-normal text-[#17201a] outline-none transition focus:ring-4 focus:ring-slate-200";

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
    <form onSubmit={submitReview} className="grid gap-5">
      <label className="sr-only" aria-hidden="true">
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-black text-slate-900">{service}</p>
        {area ? <p className="mt-1">{area}</p> : null}
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: primaryColor }}>
          {text.verified}
        </p>
      </div>

      <fieldset disabled={submitted}>
        <legend className="text-sm font-black text-slate-800">
          {text.rating} <span className="text-red-700">*</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={text.rating}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
              aria-label={`${value} ${text.stars}`}
              className="grid size-11 place-items-center rounded-xl border bg-white transition focus:outline-none focus:ring-4 focus:ring-slate-200"
              style={{
                borderColor: rating >= value ? primaryColor : "#cbd5e1",
                color: rating >= value ? primaryColor : "#94a3b8",
              }}
            >
              <Star className="size-5" fill="currentColor" aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm font-black text-slate-800">
        {text.name} <span className="text-red-700">*</span>
        <input
          name="reviewer_name"
          required
          autoComplete="name"
          maxLength={80}
          defaultValue={customerName === "Customer" ? "" : customerName}
          disabled={submitted}
          className={inputClassName}
        />
      </label>

      <label className="grid gap-2 text-sm font-black text-slate-800">
        {text.experience} <span className="text-red-700">*</span>
        <textarea
          name="message"
          required
          rows={6}
          minLength={10}
          maxLength={1_000}
          disabled={submitted}
          className={`resize-y ${inputClassName}`}
          placeholder={text.placeholder}
        />
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        <input
          name="consent"
          value="true"
          required
          type="checkbox"
          disabled={submitted}
          className="mt-1 size-4 shrink-0"
          style={{ accentColor: primaryColor }}
        />
        <span>{text.consent.replace("företaget", companyName).replace("the company", companyName)}</span>
      </label>

      {submissionMessage ? (
        <p
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
            submissionMessage.kind === "error"
              ? "bg-red-50 text-red-800"
              : "bg-emerald-50 text-emerald-800"
          }`}
          role={submissionMessage.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {submissionMessage.kind === "error" ? (
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          )}
          {submissionMessage.text}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || submitted}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-70"
        style={{ backgroundColor: primaryColor }}
      >
        {isSubmitting ? (
          <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : submitted ? (
          <CheckCircle2 className="size-5" aria-hidden="true" />
        ) : (
          <Star className="size-5" aria-hidden="true" />
        )}
        {isSubmitting ? text.submitting : submitted ? text.submitted : text.submit}
      </button>
    </form>
  );
}
