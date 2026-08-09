"use client";

import { useState, type FormEvent } from "react";

import { publicBusinessCopy, type PublicBusinessLocale } from "@/lib/public-business-locale";

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

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label={t.aria(serviceName)}>
      <input type="hidden" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">{t.name}<input name="name" required minLength={2} maxLength={160} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
        <label className="grid gap-2 text-sm font-bold">{t.email}<input name="email" required type="email" maxLength={180} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
        <label className="grid gap-2 text-sm font-bold">{t.phone}<input name="phone" type="tel" maxLength={80} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
        <label className="grid gap-2 text-sm font-bold">{t.city}<input name="city" maxLength={120} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
        <label className="grid gap-2 text-sm font-bold">{t.postalCode}<input name="postalCode" maxLength={24} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
        <label className="grid gap-2 text-sm font-bold">{t.preferredDate}<input name="preferredDate" maxLength={80} placeholder={t.preferredDatePlaceholder} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
      </div>
      <label className="grid gap-2 text-sm font-bold">{t.description}<textarea name="description" required minLength={10} maxLength={4000} rows={5} className="rounded-xl border border-black/15 bg-white px-4 py-3 font-normal text-black" /></label>
      {status === "success" ? <p role="status" className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]">{t.success}{referenceId ? ` · ${t.reference} ${referenceId}` : ""}.</p> : null}
      {status === "error" ? <p role="alert" className="rounded-xl bg-[#fff3ef] p-4 text-sm font-bold text-[#8f2f1b]">{t.error}</p> : null}
      <button type="submit" disabled={status === "submitting"} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--business-primary,#17452f)] px-5 py-3 font-black text-white disabled:opacity-50">{status === "submitting" ? t.sending : t.submit}</button>
    </form>
  );
}
