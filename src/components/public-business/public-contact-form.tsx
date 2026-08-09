"use client";

import { useState, type FormEvent } from "react";

import { publicBusinessCopy, type PublicBusinessLocale } from "@/lib/public-business-locale";

export function PublicBusinessContactForm({
  workspaceId,
  serviceId,
  locale = "sv",
}: {
  workspaceId: string;
  serviceId?: string;
  locale?: PublicBusinessLocale;
}) {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const t = publicBusinessCopy[locale].contactForm;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setState("sending");

    try {
      const response = await fetch("/api/public-business/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          serviceId: serviceId || null,
          name: String(formData.get("name") ?? ""),
          email: String(formData.get("email") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          message: String(formData.get("message") ?? ""),
          website: String(formData.get("website") ?? ""),
        }),
      });
      if (!response.ok) throw new Error("contact_failed");
      setState("success");
      form.reset();
    } catch {
      setState("error");
    }
  }

  if (state === "success") {
    return <div className="rounded-2xl bg-[#edf6f0] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe0d4]" role="status">{t.success}</div>;
  }

  const fieldClass = "min-h-12 rounded-xl border border-black/15 bg-transparent px-4 py-3 text-sm outline-none transition focus:border-[var(--business-primary)] focus:ring-2 focus:ring-[var(--business-primary)]/15";
  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold">{t.name}<input name="name" required maxLength={120} className={fieldClass} /></label>
        <label className="grid gap-1.5 text-sm font-bold">{t.email}<input name="email" required type="email" maxLength={160} className={fieldClass} /></label>
      </div>
      <label className="grid gap-1.5 text-sm font-bold">{t.phone} <span className="font-normal opacity-70">{t.optional}</span><input name="phone" type="tel" maxLength={40} className={fieldClass} /></label>
      <label className="grid gap-1.5 text-sm font-bold">{t.message}<textarea name="message" required minLength={2} maxLength={1000} rows={5} className={fieldClass} /></label>
      <label className="hidden" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {state === "error" ? <p className="text-sm font-semibold text-[#9b2c20]" role="alert">{t.error}</p> : null}
      <button type="submit" disabled={state === "sending"} className="inline-flex min-h-12 w-fit items-center justify-center rounded-xl bg-[var(--business-primary)] px-5 font-black text-white disabled:cursor-wait disabled:opacity-60">{state === "sending" ? t.sending : t.submit}</button>
    </form>
  );
}
