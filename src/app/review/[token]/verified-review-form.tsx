"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Star } from "lucide-react";

type VerifiedReviewFormProps = {
  token: string;
  customerName: string;
  service: string;
  area: string | null;
};

type SubmissionMessage = { kind: "success" | "error"; text: string } | null;

const inputClassName =
  "rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-normal text-[#071b42] outline-none transition focus:border-[#0a3c8f] focus:ring-4 focus:ring-[#dbe7ff]";

export function VerifiedReviewForm({
  token,
  customerName,
  service,
  area,
}: VerifiedReviewFormProps) {
  const formStartedAtRef = useRef<number | null>(null);
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionMessage, setSubmissionMessage] =
    useState<SubmissionMessage>(null);

  useEffect(() => {
    formStartedAtRef.current = Date.now();
  }, []);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || submitted) return;

    if (!rating) {
      setSubmissionMessage({
        kind: "error",
        text: "Please choose a star rating before submitting your review.",
      });
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
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          result?.error ?? "We couldn't submit your review. Please try again.",
        );
      }

      form.reset();
      setRating(0);
      setSubmitted(true);
      setSubmissionMessage({
        kind: "success",
        text: "Thank you. Your verified review was received and will appear after approval.",
      });
    } catch (error) {
      setSubmissionMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "We couldn't submit your review. Please try again.",
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

      <div className="rounded-2xl border border-[#dbe5f6] bg-[#f6f9ff] p-4 text-sm text-[#29436f]">
        <p className="font-black text-[#071b42]">{service}</p>
        {area ? <p className="mt-1">{area}</p> : null}
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#315997]">
          Verified completed service
        </p>
      </div>

      <fieldset disabled={submitted}>
        <legend className="text-sm font-black text-[#152853]">
          Your rating <span className="text-[#9b301f]">*</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Choose a star rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
              aria-label={`${value} out of 5 stars`}
              className={`grid size-11 place-items-center rounded-xl border transition focus:outline-none focus:ring-4 focus:ring-[#dbe7ff] ${
                rating >= value
                  ? "border-[#0a3c8f] bg-[#eaf0fc] text-[#0a3c8f]"
                  : "border-slate-300 bg-white text-slate-400 hover:border-[#7697cd]"
              }`}
            >
              <Star className="size-5" fill="currentColor" aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Your name <span className="text-[#9b301f]">*</span>
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

      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Tell us about your experience <span className="text-[#9b301f]">*</span>
        <textarea
          name="message"
          required
          rows={6}
          minLength={10}
          maxLength={1_000}
          disabled={submitted}
          className={`resize-y ${inputClassName}`}
          placeholder="What did PrimeView do well?"
        />
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-[#d9e4f7] bg-[#f6f9ff] p-4 text-sm leading-6 text-[#243a63]">
        <input
          name="consent"
          value="true"
          required
          type="checkbox"
          disabled={submitted}
          className="mt-1 size-4 shrink-0 accent-[#0a3c8f]"
        />
        <span>
          I agree that PrimeView may publish my name, rating, service details and
          review on its website.
        </span>
      </label>

      {submissionMessage ? (
        <p
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
            submissionMessage.kind === "error"
              ? "bg-[#fff0ee] text-[#9f2d20]"
              : "bg-[#edf8ef] text-[#185c2a]"
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
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0a3c8f] px-5 py-3 text-sm font-black !text-white transition hover:bg-[#061b42] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <LoaderCircle
            className="size-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : submitted ? (
          <CheckCircle2 className="size-5" aria-hidden="true" />
        ) : (
          <Star className="size-5" aria-hidden="true" />
        )}
        {isSubmitting
          ? "Submitting review..."
          : submitted
            ? "Review submitted"
            : "Submit verified review"}
      </button>
    </form>
  );
}
