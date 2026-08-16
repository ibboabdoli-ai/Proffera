import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";

import type { WorkspaceMarketplaceReadiness } from "@/lib/workspace-marketplace-readiness";

type Locale = "sv" | "en";

const copy = {
  sv: {
    eyebrow: "Marketplace",
    title: "Gör företaget redo för lokala förfrågningar",
    description: "Proffera matchar inte lokala leads förrän alla säkerhetskrav nedan är uppfyllda. Inget publiceras eller aktiveras automatiskt.",
    claim: "Företaget är verifierat och claimat",
    contact: "Giltig kontakt-e-post finns",
    entitlement: "Lead-hantering är aktiv i planen",
    service: "Minst en aktiv publicerad offert-/kontakttjänst finns",
    area: "En sådan tjänst har ett uttryckligt serviceområde",
    servicesCta: "Öppna tjänster & inställningar",
    featuresCta: "Kontrollera funktioner",
  },
  en: {
    eyebrow: "Marketplace",
    title: "Get the business ready for local enquiries",
    description: "Proffera will not match local leads until every safety requirement below is satisfied. Nothing is published or enabled automatically.",
    claim: "The business is verified and claimed",
    contact: "A valid contact email is configured",
    entitlement: "Lead management is enabled by the plan",
    service: "At least one active published quote/contact service exists",
    area: "That service has an explicit service area",
    servicesCta: "Open services & settings",
    featuresCta: "Check features",
  },
} as const;

function localizedHref(href: string, locale: Locale) {
  return locale === "en" ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

export function DashboardMarketplaceReadiness({
  readiness,
  locale,
}: {
  readiness: WorkspaceMarketplaceReadiness | null;
  locale: Locale;
}) {
  if (!readiness?.canManage || readiness.ready) return null;

  const text = copy[locale];
  const steps = [
    { label: text.claim, done: readiness.claimReady },
    { label: text.contact, done: readiness.contactReady },
    { label: text.entitlement, done: readiness.entitlementReady },
    { label: text.service, done: readiness.leadServiceReady },
    { label: text.area, done: readiness.serviceAreaReady },
  ];

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="marketplace-readiness-title">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">{text.eyebrow}</p>
      <h2 id="marketplace-readiness-title" className="mt-1 text-xl font-black text-ink">{text.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{text.description}</p>

      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {steps.map((step) => (
          <li key={step.label} className="flex items-start gap-3 rounded-control border border-line bg-surface-subtle px-4 py-3 text-sm font-semibold text-ink">
            {step.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            ) : (
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
            )}
            <span>{step.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={localizedHref("/dashboard/installningar", locale)} className="inline-flex min-h-10 items-center justify-center rounded-control bg-brand-deep px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-hover">
          {text.servicesCta}
        </Link>
        <Link href={localizedHref("/dashboard/installningar/funktioner", locale)} className="inline-flex min-h-10 items-center justify-center rounded-control border border-line bg-surface px-4 py-2 text-sm font-bold text-brand transition hover:bg-brand-tint">
          {text.featuresCta}
        </Link>
      </div>
    </section>
  );
}
