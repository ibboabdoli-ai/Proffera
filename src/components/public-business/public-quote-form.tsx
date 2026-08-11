"use client";

import { useState, type FormEvent } from "react";

import { publicBusinessCopy, type PublicBusinessLocale } from "@/lib/public-business-locale";

const windowCleaningCopy = {
  sv: {
    sectionTitle: "Detaljer för fönsterputs",
    sectionLead: "Fyll i uppgifterna nedan så att företaget kan ge dig ett mer exakt pris direkt.",
    propertyType: "Typ av fastighet",
    propertyTypeOptions: ["Hus", "Lägenhet", "Kommersiell lokal"],
    floors: "Antal våningar",
    floorsOptions: ["Endast bottenvåning", "Bottenvåning + 1 våning", "Bottenvåning + 2 våningar", "Annat"],
    windowCount: "Ungefärligt antal fönster",
    cleaningScope: "Vilken rengöring önskar du?",
    cleaningScopeOptions: ["Endast utsida", "In- och utsida"],
    framesSills: "Ska karmar och fönsterbleck rengöras?",
    yes: "Ja",
    no: "Nej",
    frequency: "Hur ofta?",
    frequencyOptions: ["Engångsjobb", "Var 4:e vecka", "Var 6:e vecka", "Var 8:e vecka"],
    difficultAccess: "Finns det fönster med svår åtkomst?",
    notSure: "Osäker",
    extraNotes: "Övrig information",
    extraNotesPlaceholder: "Till exempel uterum, tillbyggnad, hinder eller annan information som påverkar åtkomsten.",
  },
  en: {
    sectionTitle: "Window cleaning details",
    sectionLead: "Add these details so we can give you a more accurate quote without unnecessary back-and-forth.",
    propertyType: "Property type",
    propertyTypeOptions: ["House", "Flat", "Commercial"],
    floors: "Number of floors",
    floorsOptions: ["Ground floor only", "Ground + 1st floor", "Ground + 2 floors", "Other"],
    windowCount: "Approximate number of windows",
    cleaningScope: "Cleaning required",
    cleaningScopeOptions: ["Outside only", "Inside & outside"],
    framesSills: "Include frames & sills?",
    yes: "Yes",
    no: "No",
    frequency: "How often?",
    frequencyOptions: ["One-off", "Every 4 weeks", "Every 6 weeks", "Every 8 weeks"],
    difficultAccess: "Any difficult-access windows?",
    notSure: "Not sure",
    extraNotes: "Additional details",
    extraNotesPlaceholder: "For example, conservatory, extension, obstacles or anything else that may affect access.",
  },
} as const;

export function PublicBusinessQuoteForm({
  workspaceSlug,
  serviceId,
  serviceName,
  locale = "sv",
}: {
  workspaceSlug: string;
  serviceId: string;
  serviceName: string;
  locale?: PublicBusinessLocale;
}) {
  const [formStartedAt] = useState(() => Date.now());
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [referenceId, setReferenceId] = useState("");
  const t = publicBusinessCopy[locale].quoteForm;
  const windowT = windowCleaningCopy[locale];
  const isWindowCleaning = /window|fönster/i.test(serviceName);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setReferenceId("");

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const customerDescription = String(form.get("description") ?? "").trim();

    const windowDetails = isWindowCleaning
      ? [
          `Property type: ${String(form.get("propertyType") ?? "")}`,
          `Floors: ${String(form.get("floors") ?? "")}`,
          `Approx. windows: ${String(form.get("windowCount") ?? "")}`,
          `Cleaning: ${String(form.get("cleaningScope") ?? "")}`,
          `Frames & sills: ${String(form.get("framesSills") ?? "")}`,
          `Frequency: ${String(form.get("frequency") ?? "")}`,
          `Difficult access: ${String(form.get("difficultAccess") ?? "")}`,
        ]
      : [];

    const description = isWindowCleaning
      ? [...windowDetails, customerDescription ? `Additional details: ${customerDescription}` : ""]
          .filter(Boolean)
          .join("\n")
      : customerDescription;

    const payload = {
      serviceId,
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      city: String(form.get("city") ?? ""),
      postalCode: String(form.get("postalCode") ?? ""),
      description,
      preferredDate: String(form.get("preferredDate") ?? ""),
      website: String(form.get("website") ?? ""),
      formStartedAt,
    };

    try {
      const response = await fetch(`/api/public-business/workspaces/${encodeURIComponent(workspaceSlug)}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) {
        setStatus("error");
        return;
      }
      setReferenceId(String(result.referenceId ?? ""));
      setStatus("success");
      formElement.reset();
    } catch {
      setStatus("error");
    }
  }

  const fieldClass = "rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black";

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label={t.aria(serviceName)}>
      <input type="hidden" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">{t.name}<input name="name" required minLength={2} maxLength={160} className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-bold">{t.email}<input name="email" required type="email" maxLength={180} className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-bold">{t.phone}<input name="phone" type="tel" maxLength={80} className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-bold">{t.city}<input name="city" maxLength={120} className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-bold">{t.postalCode}<input name="postalCode" maxLength={24} className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-bold">{t.preferredDate}<input name="preferredDate" maxLength={80} placeholder={t.preferredDatePlaceholder} className={fieldClass} /></label>
      </div>

      {isWindowCleaning ? (
        <fieldset className="grid gap-4 rounded-2xl border border-black/10 bg-black/[0.025] p-4 sm:p-5">
          <div>
            <legend className="text-base font-black">{windowT.sectionTitle}</legend>
            <p className="mt-1 text-sm font-normal text-black/65">{windowT.sectionLead}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold">
              {windowT.propertyType}
              <select name="propertyType" required defaultValue="" className={fieldClass}>
                <option value="" disabled>—</option>
                {windowT.propertyTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {windowT.floors}
              <select name="floors" required defaultValue="" className={fieldClass}>
                <option value="" disabled>—</option>
                {windowT.floorsOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {windowT.windowCount}
              <input name="windowCount" required type="number" min={1} max={200} inputMode="numeric" className={fieldClass} />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {windowT.cleaningScope}
              <select name="cleaningScope" required defaultValue="" className={fieldClass}>
                <option value="" disabled>—</option>
                {windowT.cleaningScopeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {windowT.framesSills}
              <select name="framesSills" required defaultValue="Yes" className={fieldClass}>
                <option value="Yes">{windowT.yes}</option>
                <option value="No">{windowT.no}</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              {windowT.frequency}
              <select name="frequency" required defaultValue="" className={fieldClass}>
                <option value="" disabled>—</option>
                {windowT.frequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold sm:col-span-2">
              {windowT.difficultAccess}
              <select name="difficultAccess" required defaultValue="" className={fieldClass}>
                <option value="" disabled>—</option>
                <option value="Yes">{windowT.yes}</option>
                <option value="No">{windowT.no}</option>
                <option value="Not sure">{windowT.notSure}</option>
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm font-bold">
            {windowT.extraNotes}
            <textarea name="description" maxLength={3000} rows={4} placeholder={windowT.extraNotesPlaceholder} className={fieldClass} />
          </label>
        </fieldset>
      ) : (
        <label className="grid gap-2 text-sm font-bold">{t.description}<textarea name="description" required minLength={10} maxLength={4000} rows={5} className={fieldClass} /></label>
      )}

      {status === "success" ? <p role="status" className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]">{t.success}{referenceId ? ` · ${t.reference} ${referenceId}` : ""}.</p> : null}
      {status === "error" ? <p role="alert" className="rounded-xl bg-[#fff3ef] p-4 text-sm font-bold text-[#8f2f1b]">{t.error}</p> : null}
      <button type="submit" disabled={status === "submitting"} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--business-primary,#17452f)] px-5 py-3 font-black text-white disabled:opacity-50">{status === "submitting" ? t.sending : t.submit}</button>
    </form>
  );
}
