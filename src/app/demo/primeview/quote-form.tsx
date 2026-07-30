"use client";

import { type FormEvent, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";

type PrimeViewQuoteFormProps = {
  serviceOptions: readonly string[];
};

type SubmissionMessage =
  | { kind: "success" | "partial" | "error"; text: string }
  | null;

const inputClassName = "rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-normal text-[#071b42] outline-none transition focus:border-[#0a3c8f] focus:ring-4 focus:ring-[#dbe7ff]";

export function PrimeViewQuoteForm({ serviceOptions }: PrimeViewQuoteFormProps) {
  const [formStartedAt, setFormStartedAt] = useState(() => Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<SubmissionMessage>(null);

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = {
      name: String(values.get("name") ?? ""),
      phone: String(values.get("phone") ?? ""),
      email: String(values.get("email") ?? ""),
      postcode: String(values.get("postcode") ?? ""),
      service: String(values.get("service") ?? ""),
      message: String(values.get("message") ?? ""),
      website: String(values.get("website") ?? ""),
      formStartedAt,
    };

    setIsSubmitting(true);
    setSubmissionMessage(null);

    try {
      const response = await fetch("/api/primeview/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { confirmationSent?: boolean; error?: string } | null;

      if (!response.ok || !result) {
        throw new Error(result?.error ?? "We couldn't send your request. Please try again or contact us by phone.");
      }

      form.reset();
      setFormStartedAt(Date.now());
      setSubmissionMessage(
        result.confirmationSent === false
          ? {
              kind: "partial",
              text: "Your request has been sent to PrimeView. We could not send the confirmation email, but they have your details.",
            }
          : {
              kind: "success",
              text: "Thank you — your quote request has been sent. Please check your email for confirmation.",
            },
      );
    } catch (error) {
      setSubmissionMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "We couldn't send your request. Please try again or contact us by phone.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitQuote} className="grid gap-5 p-8 sm:grid-cols-2 md:p-11">
      <label className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Name
        <input name="name" required autoComplete="name" maxLength={160} className={inputClassName} />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Phone
        <input name="phone" required type="tel" inputMode="tel" autoComplete="tel" maxLength={80} className={inputClassName} />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#152853] sm:col-span-2">
        Email
        <input name="email" required type="email" inputMode="email" autoComplete="email" maxLength={180} className={inputClassName} />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Postcode
        <input name="postcode" required autoComplete="postal-code" maxLength={16} className={inputClassName} />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Service
        <select name="service" required defaultValue="" className={inputClassName}>
          <option value="" disabled>Select a service</option>
          {serviceOptions.map((service) => <option key={service} value={service}>{service}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-black text-[#152853] sm:col-span-2">
        Property details / message
        <textarea name="message" required rows={5} maxLength={2_000} placeholder="For example: number of floors, access details, or what you would like cleaned." className={`resize-y ${inputClassName} placeholder:text-slate-400`} />
      </label>
      {submissionMessage ? (
        <p
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold sm:col-span-2 ${submissionMessage.kind === "error" ? "bg-[#fff0ee] text-[#9f2d20]" : "bg-[#edf8ef] text-[#185c2a]"}`}
          role={submissionMessage.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {submissionMessage.kind === "error" ? <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
          {submissionMessage.text}
        </p>
      ) : null}
      <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0a3c8f] px-6 py-4 font-black !text-white shadow-[0_10px_22px_rgba(10,60,143,.22)] transition hover:-translate-y-0.5 hover:bg-[#061b42] disabled:cursor-not-allowed disabled:opacity-70 sm:col-span-2 motion-reduce:transform-none motion-reduce:transition-none" style={{ color: "#ffffff" }}>
        {isSubmitting ? <><LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Sending your request…</> : <>Request My Free Quote <ArrowRight className="size-5" aria-hidden="true" /></>}
      </button>
      <p className="text-center text-xs leading-5 text-slate-500 sm:col-span-2">Your details are sent securely to PrimeView. We&apos;ll also email you a confirmation.</p>
    </form>
  );
}
