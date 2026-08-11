"use client";

import { type FormEvent, useState } from "react";
import { ArrowRight, Calculator, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type PrimeViewQuoteFormProps = {
  serviceOptions: readonly string[];
};

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
const fieldClass = "min-h-12 w-full rounded-xl border border-[#cbd8e6] bg-white px-4 py-3 text-[15px] font-normal text-[#0b2a4a] outline-none transition placeholder:text-[#7b8da1] focus:border-[#2f80ed] focus:ring-4 focus:ring-[#2f80ed]/10";

export function PrimeViewQuoteForm({ serviceOptions }: PrimeViewQuoteFormProps) {
  const router = useRouter();
  const [postcode, setPostcode] = useState("");
  const [service, setService] = useState("");
  const [error, setError] = useState("");

  function startBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedPostcode = postcode.trim().toUpperCase();

    if (!UK_POSTCODE.test(normalizedPostcode)) {
      setError("Enter a valid UK postcode, for example W4 3ES.");
      return;
    }

    if (!service) {
      setError("Choose a service to continue.");
      return;
    }

    setError("");
    const query = new URLSearchParams({ postcode: normalizedPostcode, service });
    router.push(`/booking?${query.toString()}`);
  }

  return (
    <form onSubmit={startBooking} className="grid content-center gap-5 p-8 md:p-11">
      <div>
        <p className="text-xs font-black uppercase tracking-[.16em] text-[#315997]">Instant price & online booking</p>
        <h3 className="mt-2 text-3xl font-black tracking-[-.03em] text-[#071b42]">Get your price in under a minute.</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">Start with your postcode and service. The full PrimeView calculator will then price the job from the property details you enter.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-black text-[#152853]">
          UK postcode
          <input
            name="postcode"
            required
            autoComplete="postal-code"
            maxLength={16}
            value={postcode}
            onChange={(event) => setPostcode(event.target.value)}
            placeholder="e.g. W4 3ES"
            className={fieldClass}
          />
        </label>

        <label className="grid gap-2 text-sm font-black text-[#152853]">
          Service
          <select name="service" required value={service} onChange={(event) => setService(event.target.value)} className={fieldClass}>
            <option value="" disabled>Select a service</option>
            {serviceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      {error ? <p role="alert" className="rounded-xl border border-[#f1c7c0] bg-[#fff4f2] px-4 py-3 text-sm font-bold text-[#9a2f23]">{error}</p> : null}

      <button type="submit" className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0a3c8f] px-5 py-4 text-base font-black text-white shadow-[0_12px_26px_rgba(10,60,143,.2)] transition hover:bg-[#061b42]">
        <Calculator className="size-5" aria-hidden="true" /> Get My Instant Price <ArrowRight className="size-5" aria-hidden="true" />
      </button>

      <div className="flex flex-col gap-3 border-t border-[#e2e8f2] pt-4 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>No payment required. Final price is confirmed after the property and job details are reviewed. <a href="/privacy" className="font-bold text-[#0a3c8f] underline underline-offset-2">Privacy Policy</a></p>
        <a href="https://wa.me/447500338585" target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 font-black text-[#0a3c8f] hover:text-[#06183b]">
          <MessageCircle className="size-4" aria-hidden="true" /> Complex job? WhatsApp us
        </a>
      </div>
    </form>
  );
}
