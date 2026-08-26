import type { Metadata } from "next";

import { getAdminMarketplaceFunnelSnapshot } from "@/features/admin/marketplace-funnel";
import { requireAdminArea } from "@/lib/admin-authorization";

export const metadata: Metadata = {
  title: "Marketplace funnel | Admin",
  description: "Read-only Marketplace funnel för Proffera Quote Admin.",
};

export const dynamic = "force-dynamic";

const stages = [
  { key: "requests", label: "Requests" },
  { key: "invitedRequests", label: "Invited" },
  { key: "viewedRequests", label: "Viewed" },
  { key: "respondedRequests", label: "Responded" },
  { key: "offeredRequests", label: "Offers" },
  { key: "selectedRequests", label: "Selected" },
  { key: "serviceJobRequests", label: "Service jobs" },
  { key: "completedJobRequests", label: "Completed jobs" },
  { key: "verifiedReviewRequests", label: "Verified reviews" },
] as const;

export default async function MarketplaceFunnelAdminPage() {
  await requireAdminArea("quote_admin");
  const result = await getAdminMarketplaceFunnelSnapshot();

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#17452f]">Quote admin</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#17201a]">Marketplace funnel</h1>
          <p className="mt-3 max-w-2xl text-[#5b665f]">
            Read-only requestnivå för de senaste 30 dagarna. Flera waves, offers, jobbhändelser eller reviews räknas inte dubbelt.
          </p>
        </div>

        {result.ok ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stages.map((stage) => (
              <article key={stage.key} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
                <p className="text-sm font-semibold text-[#5b665f]">{stage.label}</p>
                <p className="mt-2 text-3xl font-bold text-[#17201a]">{result.snapshot[stage.key]}</p>
              </article>
            ))}
          </div>
        ) : (
          <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="font-semibold text-[#17201a]">Funneldata är inte tillgänglig</p>
            <p className="mt-2 text-sm text-[#5b665f]">{result.message}</p>
          </section>
        )}

        <p className="mt-5 text-xs text-[#768079]">
          Observability only: inga statusar, offers, utskick, reviews eller betalningar ändras från den här vyn.
        </p>
      </section>
    </main>
  );
}
