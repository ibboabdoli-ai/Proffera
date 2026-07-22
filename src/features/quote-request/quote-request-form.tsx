"use client";

import { CheckCircle2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { submitQuoteRequest } from "./actions";
import {
  initialQuoteRequest,
  quoteRequestSchema,
  serviceTypesByCategory,
  type QuoteRequestErrors,
  type QuoteRequestField,
  type QuoteRequestInput,
} from "./schema";

const steps = ["Tjänst", "Plats", "Beskrivning", "Kontakt", "Granska"] as const;

const preferredDates = [
  "Så snart som möjligt",
  "Inom 1 vecka",
  "Inom 1 månad",
  "Jag är flexibel",
] as const;

const stepFields: Record<number, QuoteRequestField[]> = {
  0: ["category", "serviceType"],
  1: ["city", "postalCode"],
  2: ["description", "preferredDate"],
  3: ["contactName", "contactEmail", "contactPhone", "consentAccepted"],
  4: [],
};

function collectErrors(input: QuoteRequestInput): QuoteRequestErrors {
  const parsed = quoteRequestSchema.safeParse(input);

  if (parsed.success) {
    return {};
  }

  return parsed.error.issues.reduce<QuoteRequestErrors>((acc, issue) => {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in acc)) {
      acc[field as QuoteRequestField] = issue.message;
    }
    return acc;
  }, {});
}

function ErrorText({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm font-medium text-red-700">{message}</p>;
}

export function QuoteRequestForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<QuoteRequestInput>(initialQuoteRequest);
  const [website, setWebsite] = useState("");
  const [formStartedAt] = useState(() => Date.now());
  const [errors, setErrors] = useState<QuoteRequestErrors>({});
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableServiceTypes = useMemo(() => {
    if (!formData.category || !Object.hasOwn(serviceTypesByCategory, formData.category)) {
      return [];
    }

    return serviceTypesByCategory[formData.category as keyof typeof serviceTypesByCategory];
  }, [formData.category]);

  const progress = Math.round(((step + 1) / steps.length) * 100);

  function updateField<Field extends QuoteRequestField>(field: Field, value: QuoteRequestInput[Field]) {
    setFormData((current) => ({
      ...current,
      [field]: value,
      ...(field === "category" ? { serviceType: "" } : {}),
    }));
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }));
  }

  function validateCurrentStep() {
    const allErrors = collectErrors(formData);
    const currentFields = stepFields[step] ?? [];
    const stepErrors = currentFields.reduce<QuoteRequestErrors>((acc, field) => {
      if (allErrors[field]) {
        acc[field] = allErrors[field];
      }
      return acc;
    }, {});

    setErrors((current) => ({ ...current, ...stepErrors }));
    return Object.keys(stepErrors).length === 0;
  }

  function goNext() {
    if (!validateCurrentStep()) {
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  function handleSubmit() {
    const allErrors = collectErrors(formData);

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return;
    }

    startTransition(() => {
      void submitQuoteRequest({ ...formData, website, formStartedAt }).then((result) => {
        if (!result.ok) {
          setErrors(result.errors);
          return;
        }

        setReferenceId(result.referenceId);
        setErrors({});
      });
    });
  }

  if (referenceId) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dfe5dd]">
        <CheckCircle2 className="h-12 w-12 text-[#17452f]" aria-hidden="true" />
        <h2 className="mt-5 text-2xl font-bold text-[#17201a]">Förfrågan är skickad</h2>
        <p className="mt-3 text-[#5b665f]">
          Tack! Din förfrågan har validerats och sparats. Nästa steg är att koppla adminvy och matchning mot företag.
        </p>
        <div className="mt-6 rounded-2xl bg-[#eef5ef] p-4 text-sm font-semibold text-[#17452f]">
          Referensnummer: {referenceId}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd] sm:p-8">
      <label className="absolute left-[-10000px]" aria-hidden="true">
        Webbplats
        <input name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </label>
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 text-sm font-semibold text-[#17452f]">
          <span>Steg {step + 1} av {steps.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8eee8]">
          <div className="h-full rounded-full bg-[#17452f] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-[#5b665f]">
          {steps.map((label, index) => (
            <span key={label} className={`rounded-full px-3 py-1 ${index === step ? "bg-[#17452f] text-white" : "bg-[#f1f4f0]"}`}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {errors.form ? <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">{errors.form}</div> : null}

      {step === 0 ? (
        <div className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-[#17201a]" htmlFor="category">Kategori</label>
            <select
              id="category"
              value={formData.category}
              onChange={(event) => updateField("category", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 outline-none focus:border-[#17452f]"
            >
              <option value="">Välj kategori</option>
              {Object.keys(serviceTypesByCategory).map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <ErrorText message={errors.category} />
          </div>

          <div>
            <label className="text-sm font-semibold text-[#17201a]" htmlFor="serviceType">Tjänstetyp</label>
            <select
              id="serviceType"
              value={formData.serviceType}
              onChange={(event) => updateField("serviceType", event.target.value)}
              disabled={!formData.category}
              className="mt-2 w-full rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 outline-none focus:border-[#17452f] disabled:bg-[#f1f4f0]"
            >
              <option value="">Välj tjänstetyp</option>
              {availableServiceTypes.map((serviceType) => (
                <option key={serviceType} value={serviceType}>{serviceType}</option>
              ))}
            </select>
            <ErrorText message={errors.serviceType} />
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-[#17201a]" htmlFor="city">Stad</label>
            <input
              id="city"
              value={formData.city}
              onChange={(event) => updateField("city", event.target.value)}
              placeholder="Till exempel Stockholm"
              className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]"
            />
            <ErrorText message={errors.city} />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#17201a]" htmlFor="postalCode">Postnummer</label>
            <input
              id="postalCode"
              value={formData.postalCode}
              onChange={(event) => updateField("postalCode", event.target.value)}
              placeholder="Till exempel 151 46"
              className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]"
            />
            <ErrorText message={errors.postalCode} />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-[#17201a]" htmlFor="description">Beskriv uppdraget</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(event) => updateField("description", event.target.value)}
              rows={6}
              placeholder="Beskriv vad som ska göras, ungefärlig omfattning och annat företaget behöver veta."
              className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]"
            />
            <ErrorText message={errors.description} />
          </div>

          <div>
            <label className="text-sm font-semibold text-[#17201a]" htmlFor="preferredDate">Önskad tidpunkt</label>
            <select
              id="preferredDate"
              value={formData.preferredDate}
              onChange={(event) => updateField("preferredDate", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#dfe5dd] bg-white px-4 py-3 outline-none focus:border-[#17452f]"
            >
              <option value="">Välj tidpunkt</option>
              {preferredDates.map((dateOption) => (
                <option key={dateOption} value={dateOption}>{dateOption}</option>
              ))}
            </select>
            <ErrorText message={errors.preferredDate} />
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-[#17201a]" htmlFor="contactName">Namn</label>
            <input
              id="contactName"
              value={formData.contactName}
              onChange={(event) => updateField("contactName", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]"
            />
            <ErrorText message={errors.contactName} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-[#17201a]" htmlFor="contactEmail">E-post</label>
              <input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(event) => updateField("contactEmail", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]"
              />
              <ErrorText message={errors.contactEmail} />
            </div>
            <div>
              <label className="text-sm font-semibold text-[#17201a]" htmlFor="contactPhone">Telefon</label>
              <input
                id="contactPhone"
                value={formData.contactPhone}
                onChange={(event) => updateField("contactPhone", event.target.value)}
                className="mt-2 w-full rounded-2xl border border-[#dfe5dd] px-4 py-3 outline-none focus:border-[#17452f]"
              />
              <ErrorText message={errors.contactPhone} />
            </div>
          </div>
          <label className="flex gap-3 rounded-2xl border border-[#dfe5dd] bg-[#fbfbf8] p-4 text-sm leading-6 text-[#5b665f]">
            <input
              type="checkbox"
              checked={formData.consentAccepted}
              onChange={(event) => updateField("consentAccepted", event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span>Jag godkänner att Proffera behandlar mina uppgifter för att hantera förfrågan och kontakta mig om uppdraget.</span>
          </label>
          <ErrorText message={errors.consentAccepted} />
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          {[
            ["Kategori", formData.category],
            ["Tjänst", formData.serviceType],
            ["Stad", formData.city],
            ["Postnummer", formData.postalCode],
            ["Tidpunkt", formData.preferredDate],
            ["Namn", formData.contactName],
            ["E-post", formData.contactEmail],
            ["Telefon", formData.contactPhone],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#dfe5dd] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5b665f]">{label}</p>
              <p className="mt-1 font-semibold text-[#17201a]">{value || "Ej angivet"}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-[#dfe5dd] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#5b665f]">Beskrivning</p>
            <p className="mt-1 text-[#17201a]">{formData.description || "Ej angivet"}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#dfe5dd] pt-6 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || isPending}
          className="rounded-full border border-[#dfe5dd] px-5 py-3 text-sm font-semibold text-[#17452f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tillbaka
        </button>

        {step < steps.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0e2e1e]"
          >
            Fortsätt
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0e2e1e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Skickar..." : "Skicka förfrågan"}
          </button>
        )}
      </div>
    </div>
  );
}
