"use client";

import { useState, type FormEvent } from "react";

export function PublicBusinessQuoteForm({
  workspaceSlug,
  serviceId,
  serviceName,
}: {
  workspaceSlug: string;
  serviceId: string;
  serviceName: string;
}) {
  const [formStartedAt] = useState(() => Date.now());
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [referenceId, setReferenceId] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setReferenceId("");

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      serviceId,
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      city: String(form.get("city") ?? ""),
      postalCode: String(form.get("postalCode") ?? ""),
      description: String(form.get("description") ?? ""),
      preferredDate: String(form.get("preferredDate") ?? ""),
      website: String(form.get("website") ?? ""),
      formStartedAt,
    };

    try {
      const response = await fetch(`/api/public/workspaces/${encodeURIComponent(workspaceSlug)}/quotes`, {
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

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label={`Begär offert för ${serviceName}`}>
      <input type="hidden" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">Namn<input name="name" required minLength={2} maxLength={160} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
        <label className="grid gap-2 text-sm font-bold">E-post<input name="email" required type="email" maxLength={180} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
        <label className="grid gap-2 text-sm font-bold">Telefon<input name="phone" type="tel" maxLength={80} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
        <label className="grid gap-2 text-sm font-bold">Ort<input name="city" maxLength={120} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
        <label className="grid gap-2 text-sm font-bold">Postnummer<input name="postalCode" maxLength={24} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
        <label className="grid gap-2 text-sm font-bold">Önskat datum<input name="preferredDate" maxLength={80} placeholder="Till exempel nästa vecka" className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
      </div>
      <label className="grid gap-2 text-sm font-bold">Beskriv vad du behöver<textarea name="description" required minLength={10} maxLength={4000} rows={5} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
      {status === "success" ? <p role="status" className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]">Tack! Förfrågan är skickad{referenceId ? ` · Referens ${referenceId}` : ""}.</p> : null}
      {status === "error" ? <p role="alert" className="rounded-xl bg-[#fff3ef] p-4 text-sm font-bold text-[#8f2f1b]">Förfrågan kunde inte skickas just nu. Kontrollera uppgifterna och försök igen.</p> : null}
      <button type="submit" disabled={status === "submitting"} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--business-primary,#17452f)] px-5 py-3 font-black text-white disabled:opacity-50">{status === "submitting" ? "Skickar…" : "Skicka offertförfrågan"}</button>
    </form>
  );
}
