"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, LoaderCircle, PoundSterling } from "lucide-react";

type PrimeViewQuoteFormProps = {
  serviceOptions: readonly string[];
};

type SubmissionMessage =
  | { kind: "success" | "partial" | "error"; text: string }
  | null;

const inputClassName = "rounded-xl border border-slate-300 bg-white px-4 py-3.5 font-normal text-[#071b42] outline-none transition focus:border-[#0a3c8f] focus:ring-4 focus:ring-[#dbe7ff]";
const serviceDetailClassName = "grid gap-4 rounded-2xl border border-[#c8d5ee] bg-[#f5f8ff] p-5 sm:grid-cols-2";

const floorOptions = ["Ground floor only", "Ground + 1st floor", "Ground + 2 floors", "3+ floors"];
const frequencyOptions = ["One-off", "Every 4 weeks", "Every 6 weeks", "Every 8 weeks"];

export function PrimeViewQuoteForm({ serviceOptions }: PrimeViewQuoteFormProps) {
  const formStartedAtRef = useRef<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<SubmissionMessage>(null);
  const [selectedService, setSelectedService] = useState("");
  const [windowCount, setWindowCount] = useState(0);

  useEffect(() => {
    formStartedAtRef.current = Date.now();
  }, []);

  const windowEstimate = useMemo(() => {
    if (selectedService !== "Window Cleaning" || windowCount <= 0) return null;
    return {
      min: windowCount * 4,
      max: windowCount * 5,
    };
  }, [selectedService, windowCount]);

  function buildServiceDetails(values: FormData) {
    const details: string[] = [];
    const add = (label: string, name: string) => {
      const value = String(values.get(name) ?? "").trim();
      if (value) details.push(`${label}: ${value}`);
    };

    if (selectedService === "Window Cleaning") {
      add("Property type", "propertyType");
      add("Floors", "floors");
      add("Approx. windows", "windowCount");
      add("Cleaning", "cleaningScope");
      add("Frequency", "frequency");
      add("Difficult access", "difficultAccess");
      if (windowEstimate) details.push(`Website estimate: £${windowEstimate.min}–£${windowEstimate.max}`);
    }

    if (selectedService === "Gutter Cleaning") {
      add("Property type", "propertyType");
      add("Floors", "floors");
      add("Approx. gutter length", "gutterLength");
      add("Downpipes included", "downpipes");
      add("Access difficulty", "difficultAccess");
    }

    if (selectedService === "Fascia & Soffit Cleaning") {
      add("Property type", "propertyType");
      add("Floors", "floors");
      add("Sides to clean", "propertySides");
      add("Access difficulty", "difficultAccess");
    }

    if (selectedService === "Conservatory Roof Cleaning") {
      add("Conservatory size", "conservatorySize");
      add("Roof material", "roofMaterial");
      add("Frames included", "framesIncluded");
      add("Access difficulty", "difficultAccess");
    }

    if (selectedService === "Driveway & Patio Cleaning") {
      add("Area", "outdoorArea");
      add("Approx. size", "areaSize");
      add("Surface", "surfaceType");
      add("Heavy staining / moss", "heavyStaining");
    }

    if (selectedService === "Solar Panel Cleaning") {
      add("Number of panels", "panelCount");
      add("Floors", "floors");
      add("Roof type", "roofType");
      add("Access difficulty", "difficultAccess");
    }

    const notes = String(values.get("message") ?? "").trim();
    if (notes) details.push(`Additional details: ${notes}`);

    return details.join("\n");
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const message = buildServiceDetails(values) || "Quote requested from PrimeView website calculator.";
    const payload = {
      name: String(values.get("name") ?? ""),
      phone: String(values.get("phone") ?? ""),
      email: String(values.get("email") ?? ""),
      postcode: String(values.get("postcode") ?? ""),
      service: String(values.get("service") ?? ""),
      message,
      website: String(values.get("website") ?? ""),
      formStartedAt: formStartedAtRef.current ?? Date.now(),
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
      setSelectedService("");
      setWindowCount(0);
      formStartedAtRef.current = Date.now();
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
      <label className="sr-only" aria-hidden="true">
        Website
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>

      <div className="sm:col-span-2">
        <p className="text-xs font-black uppercase tracking-[.16em] text-[#315997]">UK quote calculator</p>
        <h3 className="mt-2 text-2xl font-black tracking-[-.02em] text-[#071b42]">Get a faster estimate for your property</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">Choose a service and answer a few property questions. For window cleaning, we can show an instant guide price in pounds.</p>
      </div>

      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Name
        <input name="name" required autoComplete="name" maxLength={160} className={inputClassName} />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Phone
        <input name="phone" required type="tel" inputMode="tel" autoComplete="tel" maxLength={80} placeholder="07... or +44..." className={inputClassName} />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#152853] sm:col-span-2">
        Email
        <input name="email" required type="email" inputMode="email" autoComplete="email" maxLength={180} className={inputClassName} />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#152853]">
        UK postcode
        <input name="postcode" required autoComplete="postal-code" maxLength={16} placeholder="e.g. W4 3ES" className={inputClassName} />
      </label>
      <label className="grid gap-2 text-sm font-black text-[#152853]">
        Service
        <select
          name="service"
          required
          value={selectedService}
          onChange={(event) => {
            setSelectedService(event.target.value);
            setWindowCount(0);
          }}
          className={inputClassName}
        >
          <option value="" disabled>Select a service</option>
          {serviceOptions.map((service) => <option key={service} value={service}>{service}</option>)}
        </select>
      </label>

      {selectedService === "Window Cleaning" ? (
        <div className={`${serviceDetailClassName} sm:col-span-2`}>
          <label className="grid gap-2 text-sm font-black text-[#152853]">
            Property type
            <select name="propertyType" required defaultValue="" className={inputClassName}>
              <option value="" disabled>Select</option>
              <option>House</option>
              <option>Flat</option>
              <option>Commercial property</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">
            Number of floors
            <select name="floors" required defaultValue="" className={inputClassName}>
              <option value="" disabled>Select</option>
              {floorOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">
            Approx. number of windows
            <input name="windowCount" required type="number" min={1} max={200} inputMode="numeric" onChange={(event) => setWindowCount(Number(event.target.value) || 0)} className={inputClassName} />
          </label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">
            Cleaning required
            <select name="cleaningScope" required defaultValue="" className={inputClassName}>
              <option value="" disabled>Select</option>
              <option>Outside only</option>
              <option>Inside & outside</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">
            How often?
            <select name="frequency" required defaultValue="" className={inputClassName}>
              <option value="" disabled>Select</option>
              {frequencyOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">
            Any difficult-access windows?
            <select name="difficultAccess" required defaultValue="" className={inputClassName}>
              <option value="" disabled>Select</option>
              <option>Yes</option>
              <option>No</option>
              <option>Not sure</option>
            </select>
          </label>
          <div className="rounded-2xl bg-[#071b42] p-5 text-white sm:col-span-2">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[.12em] text-[#b8ceff]"><PoundSterling className="size-5" /> Guide price</div>
            {windowEstimate ? (
              <p className="mt-2 text-3xl font-black">£{windowEstimate.min}–£{windowEstimate.max}</p>
            ) : (
              <p className="mt-2 text-lg font-bold">Enter the number of windows to see an estimate.</p>
            )}
            <p className="mt-2 text-xs leading-5 text-slate-300">Based on £4–£5 per window for exterior cleaning, including glass and frames. Final price depends on size and access.</p>
          </div>
        </div>
      ) : null}

      {selectedService === "Gutter Cleaning" ? (
        <div className={`${serviceDetailClassName} sm:col-span-2`}>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Property type<select name="propertyType" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Terraced house</option><option>Semi-detached house</option><option>Detached house</option><option>Commercial property</option></select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Number of floors<select name="floors" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option>{floorOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Approx. gutter length<input name="gutterLength" required placeholder="e.g. 20 metres" className={inputClassName} /></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Include downpipes?<select name="downpipes" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Yes</option><option>No</option><option>Not sure</option></select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853] sm:col-span-2">Any access difficulties?<select name="difficultAccess" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Yes</option><option>No</option><option>Not sure</option></select></label>
        </div>
      ) : null}

      {selectedService === "Fascia & Soffit Cleaning" ? (
        <div className={`${serviceDetailClassName} sm:col-span-2`}>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Property type<select name="propertyType" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Terraced house</option><option>Semi-detached house</option><option>Detached house</option><option>Commercial property</option></select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Number of floors<select name="floors" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option>{floorOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Sides to clean<select name="propertySides" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Front only</option><option>Front & back</option><option>3 sides</option><option>All sides</option></select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Any access difficulties?<select name="difficultAccess" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Yes</option><option>No</option><option>Not sure</option></select></label>
        </div>
      ) : null}

      {selectedService === "Conservatory Roof Cleaning" ? (
        <div className={`${serviceDetailClassName} sm:col-span-2`}>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Conservatory size<select name="conservatorySize" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Small</option><option>Medium</option><option>Large</option><option>Not sure</option></select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Roof material<select name="roofMaterial" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Glass</option><option>Polycarbonate</option><option>Not sure</option></select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Include frames?<select name="framesIncluded" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Yes</option><option>No</option></select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Any access difficulties?<select name="difficultAccess" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Yes</option><option>No</option><option>Not sure</option></select></label>
        </div>
      ) : null}

      {selectedService === "Driveway & Patio Cleaning" ? (
        <div className={`${serviceDetailClassName} sm:col-span-2`}>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Area<select name="outdoorArea" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Driveway</option><option>Patio</option><option>Driveway & patio</option><option>Path / other</option></select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Approx. size<input name="areaSize" required placeholder="e.g. 40 m²" className={inputClassName} /></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Surface<select name="surfaceType" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Block paving</option><option>Concrete</option><option>Natural stone</option><option>Decking</option><option>Not sure</option></select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Heavy staining / moss?<select name="heavyStaining" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Yes</option><option>No</option><option>Not sure</option></select></label>
        </div>
      ) : null}

      {selectedService === "Solar Panel Cleaning" ? (
        <div className={`${serviceDetailClassName} sm:col-span-2`}>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Number of panels<input name="panelCount" required type="number" min={1} max={200} inputMode="numeric" className={inputClassName} /></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Number of floors<select name="floors" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option>{floorOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Roof type<select name="roofType" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Pitched roof</option><option>Flat roof</option><option>Ground-mounted panels</option><option>Not sure</option></select></label>
          <label className="grid gap-2 text-sm font-black text-[#152853]">Any access difficulties?<select name="difficultAccess" required defaultValue="" className={inputClassName}><option value="" disabled>Select</option><option>Yes</option><option>No</option><option>Not sure</option></select></label>
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-black text-[#152853] sm:col-span-2">
        Anything else we should know? <span className="font-normal text-slate-500">(optional)</span>
        <textarea name="message" rows={4} maxLength={1_200} placeholder="Access notes, preferred day, parking, extension, conservatory or anything else that may affect the job." className={`resize-y ${inputClassName} placeholder:text-slate-400`} />
      </label>

      {selectedService && selectedService !== "Window Cleaning" ? (
        <div className="rounded-xl border border-[#c8d5ee] bg-[#f5f8ff] px-4 py-3 text-sm leading-6 text-[#27436f] sm:col-span-2">
          We&apos;ll use these details to confirm a tailored price. No made-up instant price is shown for this service.
        </div>
      ) : null}

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
      <p className="text-center text-xs leading-5 text-slate-500 sm:col-span-2">UK pricing in GBP. Your details are sent securely to PrimeView and you&apos;ll receive an email confirmation.</p>
    </form>
  );
}
