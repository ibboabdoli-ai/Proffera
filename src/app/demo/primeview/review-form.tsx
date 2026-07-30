"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Star } from "lucide-react";

type PrimeViewReviewFormProps = {
  serviceOptions: readonly string[];
};

type SubmissionMessage = { kind: "success" | "error"; text: string } | null;

const inputClassName = "rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-normal text-[#071b42] outline-none transition focus:border-[#0a3c8f] focus:ring-4 focus:ring-[#dbe7ff]";

export function PrimeViewReviewForm({ serviceOptions }: PrimeViewReviewFormProps) {
  const formStartedAtRef = useRef<number | null>(null);
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<SubmissionMessage>(null);

  useEffect(() => {
    formStartedAtRef.current = Date.now();
  }, []);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    if (!rating) {
      setSubmissionMessage({ kind: "error", text: "Please choose a star rating before submitting your review." });
      return;
    }

    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      reviewerName: String(values.get("reviewer_name") ?? ""),
      rating,
      service: String(values.get("service") ?? ""),
      area: String(values.get("area") ?? ""),
      message: String(values.get("message") ?? ""),
      consent: values.get("consent") === "true",
      website: String(values.get("website") ?? ""),
      formStartedAt: formStartedAtRef.current ?? Date.now(),
    };

    setIsSubmitting(true);
    setSubmissionMessage(null);

    try {
      const response = await fetch("/api/primeview/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? "We couldn't submit your review. Please try again shortly.");
      }

      form.reset();
      setRating(0);
      formStartedAtRef.current = Date.now();
      setSubmissionMessage({
        kind: "success",
        text: "Thank you — your review has been received and will appear after PrimeView approves it.",
      });
    } catch (error) {
      setSubmissionMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "We couldn't submit your review. Please try again shortly.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitReview} className="grid gap-4" aria-describedby="review-form-note">
      <label className="sr-only" aria-hidden="true">
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <fieldset>
        <legend className="text-sm font-black text-[#152853]">Your rating <span className="text-[#9b301f]">*</span></legend>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Choose a star rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-pressed={rating === value}
              aria-label={`${value} out of 5 stars`}
              className={`grid size-11 place-items-center rounded-xl border transition focus:outline-none focus:ring-4 focus:ring-[#dbe7ff] ${rating >= value ? "border-[#0a3c8f] bg-[#eaf0fc] text-[#0a3c8f]" : "border-slate-300 bg-white text-slate-400 hover:border-[#7697cd] hover:text-[#315997]"}`}
            >
              <Star className="size-5" fill="currentColor" aria-hidden="true" />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Your name <span className="text-[#9b301f]">*</span>
        <input name="reviewer_name" required autoComplete="name" maxLength={80} className={inputClassName} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-black text-[#152853]">
          Service used <span className="font-semibold text-slate-500">(optional)</span>
          <select name="service" defaultValue="" className={inputClassName}>
            <option value="">Choose a service</option>
            {serviceOptions.map((service) => <option key={service} value={service}>{service}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-black text-[#152853]">
          Area or postcode <span className="font-semibold text-slate-500">(optional)</span>
          <input name="area" autoComplete="postal-code" maxLength={120} className={inputClassName} />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Tell us about your experience <span className="text-[#9b301f]">*</span>
        <textarea name="message" required rows={5} minLength={10} maxLength={1_000} className={`resize-y ${inputClassName} placeholder:text-slate-400`} placeholder="What did PrimeView do well?" />
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-[#d9e4f7] bg-[#f6f9ff] p-4 text-sm leading-6 text-[#243a63]">
        <input name="consent" value="true" required type="checkbox" className="mt-1 size-4 shrink-0 accent-[#0a3c8f]" />
        <span>I agree that PrimeView may publish my name, rating, service details and review on this website.</span>
      </label>

      {submissionMessage ? (
        <p
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${submissionMessage.kind === "error" ? "bg-[#fff0ee] text-[#9f2d20]" : "bg-[#edf8ef] text-[#185c2a]"}`}
          role={submissionMessage.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {submissionMessage.kind === "error" ? <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
          {submissionMessage.text}
        </p>
      ) : null}

      <button type="submit" disabled={isSubmitting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0a3c8f] px-5 py-3 text-sm font-black !text-white shadow-[0_10px_22px_rgba(10,60,143,.18)] transition hover:bg-[#061b42] disabled:cursor-not-allowed disabled:opacity-70">
        {isSubmitting ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Star className="size-5" aria-hidden="true" />}
        {isSubmitting ? "Submitting review..." : "Submit my review"}
      </button>

      <p id="review-form-note" className="text-xs leading-5 text-slate-500">Reviews are checked before publication. Please do not include private information.</p>
    </form>
  );
}
