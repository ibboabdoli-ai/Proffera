"use client";

import Link from "next/link";
import { ArrowRight, CreditCard } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { getMarketplaceClaimPaidCtaCopy, normalizeMarketplaceClaimPaidCtaLocale } from "@/lib/marketplace-claim-paid-cta";

export function MarketplaceClaimPaidCta() {
  const searchParams = useSearchParams();
  const locale = normalizeMarketplaceClaimPaidCtaLocale(searchParams.get("lang"));
  const copy = getMarketplaceClaimPaidCtaCopy(locale);

  return (
    <section data-marketplace-claim-paid-cta className="rounded-2xl border border-brand/20 bg-brand-tint p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">{copy.eyebrow}</p>
          <div className="mt-2 flex items-center gap-2">
            <CreditCard className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <h2 className="text-lg font-black tracking-[-0.02em] text-ink">{copy.title}</h2>
          </div>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-body">{copy.description}</p>
        </div>

        <Link
          href={copy.href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-black text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {copy.action}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
