"use client";

import { CreditCard, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CheckoutPlanKey, CheckoutPlanOption } from "@/lib/billing-plans";
import type { WorkspaceBillingSummary } from "@/lib/workspace-billing";
import type { WorkspaceBillingCurrency, WorkspaceTimeZone } from "@/lib/workspace-market";

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
  checkoutPlans: CheckoutPlanOption[];
  preferredPlanKey: CheckoutPlanKey | null;
  billingCurrency: WorkspaceBillingCurrency;
  timeZone: WorkspaceTimeZone;
  locale: "sv" | "en";
  adaptivePricingEnabled: boolean;
};

export function WorkspaceBillingCard({ billing, canManage, checkoutConfigured, testMode, checkoutPlans, preferredPlanKey, billingCurrency, timeZone, locale, adaptivePricingEnabled }: WorkspaceBillingCardProps) {
  const router = useRouter();
  const [loadingPlanKey, setLoadingPlanKey] = useState<CheckoutPlanKey | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeConfirmationOpen, setUpgradeConfirmationOpen] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const hasActivePlan = billing.status === "active" || billing.status === "trialing";
  const canStartCheckout = !billing.hasSubscription || billing.status === "cancelled";
  const starterPlan = checkoutPlans.find((plan) => plan.key === "starter");
  const professionalPlan = checkoutPlans.find((plan) => plan.key === "professional");
  const starterPriceLabel = starterPlan?.configured
    ? starterPlan.priceLabel
    : locale === "en"
      ? "Price confirmed by Stripe"
      : "Pris bekräftas i Stripe";
  const canUpgrade = canManage && hasActivePlan && billing.planKey === "starter" && professionalPlan?.configured;
  const canOpenPortal = canManage && ["active", "trialing", "past_due", "paused"].includes(billing.status ?? "");
  const dateLocale = locale === "en" ? "en-GB" : "sv-SE";
  const localPriceNote = billingCurrency === "SEK"
    ? (locale === "en" ? "Prices are shown in SEK before Stripe confirms checkout." : "Priser visas i SEK innan Stripe bekräftar kassan.")
    : adaptivePricingEnabled
      ? (locale === "en" ? "Stripe confirms an eligible local currency and final amount at checkout." : "Stripe bekräftar tillgänglig lokal valuta och slutligt belopp i kassan.")
      : (locale === "en" ? "Stripe confirms the final payable currency and amount at checkout." : "Stripe bekräftar slutlig betalningsvaluta och belopp i kassan.");

  async function startCheckout(planKey: CheckoutPlanKey) {
    setLoadingPlanKey(planKey);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ planKey, lang: locale }),
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Betalningssidan kunde inte öppnas.");
      }

      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Betalningssidan kunde inte öppnas.");
      setLoadingPlanKey(null);
    }
  }

  async function upgradeToProfessional() {
    setLoadingPlanKey("professional");
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/stripe/upgrade", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json()) as { upgraded?: boolean; applied?: boolean; pending?: boolean; url?: string | null; error?: string };

      if (data.url) {
        window.location.assign(data.url);
        return;
      }

      if (!response.ok && response.status !== 202) {
        throw new Error(data.error || "Abonnemanget kunde inte uppgraderas.");
      }

      if (data.pending) {
        throw new Error(data.error || "Betalningen väntar på bekräftelse från Stripe.");
      }

      setSuccess(data.applied ? "Planen uppgraderades till Professional. CRM är nu aktivt." : "Stripe har godkänt uppgraderingen. Åtkomsten synkroniseras nu.");
      setLoadingPlanKey(null);
      router.refresh();
    } catch (upgradeError) {
      setError(upgradeError instanceof Error ? upgradeError.message : "Abonnemanget kunde inte uppgraderas.");
      setLoadingPlanKey(null);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Betalningsportalen kunde inte öppnas.");
      }

      window.location.assign(data.url);
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : "Betalningsportalen kunde inte öppnas.");
      setPortalLoading(false);
    }
  }

  return (
    <article className="rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-[#eaf8f2] text-[#087754]">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-xl font-bold text-ink">Plan och betalning</h3>
            <p className="mt-1 text-sm leading-6 text-ink-muted">Starta abonnemanget via Stripes säkra betalningssida.</p>
          </div>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${hasActivePlan ? "bg-[#eaf8f2] text-[#087754]" : "bg-surface-subtle text-ink-muted"}`}>
          {billing.status ? statusLabels[billing.status] : "Ingen aktiv plan"}
        </span>
      </div>

      {testMode ? (
        <div className="mt-5 flex items-start gap-3 rounded-card bg-[#fdf5dc] p-4 text-sm leading-6 text-[#72520f]" role="note">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p><strong>Stripe Sandbox:</strong> Stripe använder testpriser i den här miljön. Inga riktiga pengar dras.</p>
        </div>
      ) : null}

      <div className="mt-5 rounded-card border border-line bg-surface-subtle p-4 text-sm leading-6 text-ink-muted">
        <p className="font-bold text-ink">{locale === "en" ? "B2B billing market" : "B2B-betalningsmarknad"}</p>
        <p className="mt-1">{locale === "en" ? `Currency preference: ${billingCurrency}. Business time zone: ${timeZone}.` : `Valutapreferens: ${billingCurrency}. Företagets tidszon: ${timeZone}.`}</p>
        <p className="mt-1">{localPriceNote}</p>
        <p className="mt-1">{locale === "en" ? "Checkout collects the billing address and VAT number. Tax is applied only when Proffera has enabled the relevant Stripe Tax registrations." : "Kassan samlar in fakturaadress och VAT-nummer. Skatt tillämpas först när Proffera har aktiverat relevanta Stripe Tax-registreringar."}</p>
      </div>

      {billing.currentPeriodEnd && hasActivePlan ? (
        <p className="mt-4 text-sm text-ink-muted">
          {locale === "en" ? "Current period ends " : "Nuvarande period gäller till "}{new Intl.DateTimeFormat(dateLocale, { dateStyle: "long", timeZone }).format(new Date(billing.currentPeriodEnd))}.
        </p>
      ) : null}

      {hasActivePlan && billing.planKey ? (
        <p className="mt-3 text-sm font-semibold text-ink">
          Nuvarande plan: {billing.planKey === "professional" ? "Professional" : "Starter"}
        </p>
      ) : null}

      {billing.cancelAtPeriodEnd && billing.currentPeriodEnd ? (
        <p className="mt-4 rounded-control bg-[#fdf5dc] p-4 text-sm font-semibold leading-6 text-[#72520f]" role="status">
          {locale === "en" ? "The subscription ends on " : "Abonnemanget avslutas den "}{new Intl.DateTimeFormat(dateLocale, { dateStyle: "long", timeZone }).format(new Date(billing.currentPeriodEnd))}.{locale === "en" ? " You can reactivate it through Stripe before then." : " Du kan återaktivera det via Stripe innan dess."}
        </p>
      ) : null}

      {canOpenPortal ? (
        <div className="mt-5 rounded-card border border-line bg-surface-subtle p-4">
          <p className="text-sm font-bold text-ink">Hantera abonnemang</p>
          <p className="mt-1 text-sm leading-6 text-ink-muted">Öppna Stripes säkra portal för att byta betalkort, se fakturor eller avsluta abonnemanget vid periodens slut.</p>
          <button
            type="button"
            onClick={openBillingPortal}
            disabled={portalLoading || loadingPlanKey !== null}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-[#17452f] bg-surface px-5 py-3 text-sm font-semibold text-brand transition hover:bg-[#eaf8f2] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {portalLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
            {portalLoading ? "Öppnar Stripe…" : "Hantera betalning och abonnemang"}
          </button>
        </div>
      ) : null}

      {!billing.databaseReady ? (
        <p className="mt-5 rounded-card bg-surface-subtle p-4 text-sm text-ink-muted">Betalning blir tillgänglig när installationen är klar.</p>
      ) : null}

      {canManage && billing.databaseReady && checkoutConfigured && !hasActivePlan && canStartCheckout ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-ink">Välj plan</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {checkoutPlans.map((plan) => {
              const isLoading = loadingPlanKey === plan.key;
              const isPreferred = preferredPlanKey === plan.key;
              const planPriceLabel = plan.configured
                ? plan.priceLabel
                : locale === "en"
                  ? "Price confirmed by Stripe"
                  : "Pris bekräftas i Stripe";

              return (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => startCheckout(plan.key)}
                  disabled={!plan.configured || loadingPlanKey !== null}
                  className={`rounded-card border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${isPreferred ? "border-[#17452f] bg-[#eaf8f2]" : "border-line bg-surface-subtle hover:border-line-strong"}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-base font-bold text-ink">{plan.name}</span>
                      <span className="mt-1 block text-sm font-semibold text-brand">{testMode ? `${planPriceLabel} · Stripe Sandbox` : planPriceLabel}</span>
                    </span>
                    {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin text-brand" aria-hidden="true" /> : <CreditCard className="h-4 w-4 text-brand" aria-hidden="true" />}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-ink-muted">{plan.configured ? plan.description : "Inte tillgänglig ännu."}</span>
                  <span className="mt-3 block text-sm font-bold text-brand">{isLoading ? "Öppnar Stripe…" : plan.configured ? `Välj ${plan.name}` : "Förbereds"}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {canUpgrade && professionalPlan ? (
        <div className="mt-5 rounded-card border border-line bg-[#eaf8f2] p-4">
          <p className="text-base font-bold text-ink">Uppgradera till Professional</p>
          <p className="mt-1 text-sm leading-6 text-ink-muted">{professionalPlan.description}</p>

          <dl className="mt-4 divide-y divide-line rounded-control border border-line bg-surface px-4 text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-ink-muted">Nuvarande plan</dt>
              <dd className="text-right font-semibold text-ink">Starter · {starterPriceLabel}{testMode ? " (test)" : ""}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-ink-muted">Ny plan</dt>
              <dd className="text-right font-semibold text-ink">Professional · {professionalPlan.priceLabel}{testMode ? " (test)" : ""}</dd>
            </div>
          </dl>

          <div className="mt-3 rounded-control bg-surface p-4 text-sm leading-6 text-ink-muted" role="note">
            {testMode ? (
              <p><strong className="text-ink">Testbetalning:</strong> Inga riktiga pengar dras. Stripe registrerar bara uppgraderingen med testpriset.</p>
            ) : billing.status === "trialing" ? (
              <p><strong className="text-ink">Uppgradering under testperiod:</strong> Ingen tidigare Starter-betalning räknas av om testperioden varit kostnadsfri. Stripe beräknar om något ska betalas nu och Professional-priset gäller för kommande betalningsperioder. Det exakta beloppet bekräftas av Stripe.</p>
            ) : (
              <p><strong className="text-ink">Betalning vid uppgradering:</strong> Stripe räknar av det du redan betalat för Starter och debiterar bara den proportionella prisskillnaden för resten av perioden. Därefter debiteras {professionalPlan.priceLabel.replace("Från ", "")} från nästa betalningsperiod. Det exakta beloppet bekräftas av Stripe.</p>
            )}
          </div>

          {!upgradeConfirmationOpen ? (
            <button
              type="button"
              onClick={() => setUpgradeConfirmationOpen(true)}
              disabled={loadingPlanKey !== null}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-brand-deep px-5 py-3 text-sm font-semibold !text-white transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Fortsätt till bekräftelse
            </button>
          ) : (
            <div className="mt-4 rounded-control border border-line-strong bg-surface p-4" role="group" aria-labelledby="upgrade-confirmation-title">
              <p id="upgrade-confirmation-title" className="font-bold text-ink">Bekräfta uppgraderingen</p>
              <p className="mt-1 text-sm leading-6 text-ink-muted">Genom att bekräfta godkänner du bytet till Professional och Stripes betalningsvillkor ovan.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={upgradeToProfessional}
                  disabled={loadingPlanKey !== null}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand-deep px-5 py-3 text-sm font-semibold !text-white transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingPlanKey === "professional" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
                  {loadingPlanKey === "professional" ? "Uppgraderar…" : "Bekräfta och uppgradera"}
                </button>
                <button
                  type="button"
                  onClick={() => setUpgradeConfirmationOpen(false)}
                  disabled={loadingPlanKey !== null}
                  className="min-h-11 rounded-control border border-line bg-surface px-5 py-3 text-sm font-semibold text-brand transition hover:bg-surface-subtle focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {!canManage ? <p className="mt-5 text-sm text-ink-muted">Endast arbetsytans Owner kan starta eller ändra abonnemanget.</p> : null}
      {canManage && !checkoutConfigured ? <p className="mt-5 text-sm text-ink-muted">Stripe Checkout är ännu inte konfigurerad.</p> : null}
      {success ? <p className="mt-4 rounded-control bg-[#eaf8f2] p-4 text-sm font-semibold text-brand" role="status" aria-live="polite">{success}</p> : null}
      {error ? <p className="mt-4 text-sm font-semibold text-danger" role="alert" aria-live="assertive">{error}</p> : null}
    </article>
  );
}
