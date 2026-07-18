"use client";

import { CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

import type { WorkspaceBillingSummary } from "@/lib/workspace-billing";

const statusLabels = {
  pending: "Väntar på betalning",
  trialing: "Testperiod aktiv",
  active: "Aktiv",
  past_due: "Betalning saknas",
  cancelled: "Avslutad",
  paused: "Pausad",
} as const;

type WorkspaceBillingCardProps = {
  billing: WorkspaceBillingSummary;
  canManage: boolean;
  checkoutConfigured: boolean;
  testMode: boolean;
};

export function WorkspaceBillingCard({ billing, canManage, checkoutConfigured, testMode }: WorkspaceBillingCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const hasActivePlan = billing.status === "active" || billing.status === "trialing";

  async function startCheckout() {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Betalningssidan kunde inte öppnas.");
      }

      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Betalningssidan kunde inte öppnas.");
      setIsLoading(false);
    }
  }

  return (
    <article className="rounded-[24px] border border-[#dce5dc] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e7f1eb] text-[#17452f]">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-xl font-bold text-[#17201a]">Plan och betalning</h3>
            <p className="mt-1 text-sm leading-6 text-[#5b665f]">Starta abonnemanget via Stripes säkra betalningssida.</p>
          </div>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${hasActivePlan ? "bg-[#e7f1eb] text-[#17452f]" : "bg-[#f1f2ef] text-[#5b665f]"}`}>
          {billing.status ? statusLabels[billing.status] : "Ingen aktiv plan"}
        </span>
      </div>

      {testMode ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#fdf5dc] p-4 text-sm leading-6 text-[#72520f]" role="note">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p><strong>Stripe Sandbox:</strong> detta är ett testabonnemang på 1 kr/mån. Inga riktiga pengar dras.</p>
        </div>
      ) : null}

      {billing.currentPeriodEnd && hasActivePlan ? (
        <p className="mt-4 text-sm text-[#5b665f]">
          Nuvarande period gäller till {new Intl.DateTimeFormat("sv-SE", { dateStyle: "long", timeZone: "Europe/Stockholm" }).format(new Date(billing.currentPeriodEnd))}.
        </p>
      ) : null}

      {!billing.databaseReady ? (
        <p className="mt-5 rounded-2xl bg-[#f7f9f6] p-4 text-sm text-[#5b665f]">Betalning blir tillgänglig när installationen är klar.</p>
      ) : null}

      {canManage && billing.databaseReady && checkoutConfigured && !hasActivePlan ? (
        <button
          type="button"
          onClick={startCheckout}
          disabled={isLoading}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17452f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0e2e1e] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
        >
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
          {isLoading ? "Öppnar Stripe…" : testMode ? "Starta testabonnemang" : "Välj Professional"}
        </button>
      ) : null}

      {!canManage ? <p className="mt-5 text-sm text-[#5b665f]">Endast arbetsytans Owner kan starta eller ändra abonnemanget.</p> : null}
      {canManage && !checkoutConfigured ? <p className="mt-5 text-sm text-[#5b665f]">Stripe Checkout är ännu inte konfigurerad.</p> : null}
      {error ? <p className="mt-4 text-sm font-semibold text-[#9b301f]" role="alert" aria-live="assertive">{error}</p> : null}
    </article>
  );
}
