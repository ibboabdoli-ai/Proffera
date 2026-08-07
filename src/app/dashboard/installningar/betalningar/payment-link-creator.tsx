"use client";

import { useState } from "react";

import type { PayableServiceJob } from "@/lib/workspace-service-job-payments";

function money(amount: number, currency: string, locale: "sv" | "en") {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", { style: "currency", currency }).format(amount / 100);
}

export function PaymentLinkCreator({ jobs, locale }: { jobs: PayableServiceJob[]; locale: "sv" | "en" }) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>("");
  const [error, setError] = useState<string>("");
  const text = locale === "en"
    ? { title: "Job payment links", body: "Create a secure customer payment link from the job amount stored in Proffera.", create: "Create payment link", recreate: "Create new link", paid: "Paid", copy: "Copy link", empty: "No priced jobs are available for payment yet." }
    : { title: "Betalningslänkar för uppdrag", body: "Skapa en säker kundlänk från beloppet som redan är sparat på uppdraget.", create: "Skapa betalningslänk", recreate: "Skapa ny länk", paid: "Betald", copy: "Kopiera länk", empty: "Det finns inga prissatta uppdrag som kan betalas ännu." };

  async function create(jobId: string) {
    setBusy(jobId); setError("");
    try {
      const response = await fetch("/api/dashboard/service-job-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) });
      const data = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "payment_link_failed");
      setLinks((current) => ({ ...current, [jobId]: data.url! }));
    } catch {
      setError(locale === "en" ? "The payment link could not be created." : "Betalningslänken kunde inte skapas.");
    } finally { setBusy(""); }
  }

  return (
    <article className="rounded-[24px] border border-[#dfe6df] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-black text-[#17201a]">{text.title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#5c675f]">{text.body}</p>
      {error ? <p className="mt-4 rounded-xl bg-[#fff5f2] p-3 text-sm font-semibold text-[#8f2f1b]">{error}</p> : null}
      <div className="mt-5 grid gap-3">
        {jobs.length ? jobs.map((job) => (
          <div key={job.id} className="rounded-2xl border border-[#e2e7e1] bg-[#f8faf7] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-bold text-[#17201a]">{job.title}</p><p className="mt-1 text-sm text-[#68736b]">{job.customerName || "—"} · {money(job.totalMinor, job.currency, locale)}</p></div>
              {job.paymentStatus === "paid" ? <span className="w-fit rounded-full bg-[#e9f2ec] px-3 py-1 text-xs font-bold text-[#17452f]">{text.paid}</span> : <button type="button" disabled={busy === job.id} onClick={() => create(job.id)} className="min-h-10 rounded-xl bg-[#173e2b] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{links[job.id] ? text.recreate : text.create}</button>}
            </div>
            {links[job.id] ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input readOnly value={links[job.id]} className="min-h-10 flex-1 rounded-xl border border-[#cfd8cf] bg-white px-3 text-sm text-[#344139]" /><button type="button" onClick={() => navigator.clipboard.writeText(links[job.id])} className="min-h-10 rounded-xl border border-[#cfd8cf] bg-white px-4 text-sm font-bold text-[#17452f]">{text.copy}</button></div> : null}
          </div>
        )) : <p className="text-sm text-[#68736b]">{text.empty}</p>}
      </div>
    </article>
  );
}
