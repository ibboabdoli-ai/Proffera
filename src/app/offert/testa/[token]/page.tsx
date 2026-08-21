import type { Metadata } from "next";

import { getMarketplaceGuestQuoteTestView } from "@/lib/marketplace-guest-quote-test";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Guest Quote-test | Proffera",
  robots: { index: false, follow: false },
};

export default async function MarketplaceGuestQuoteTestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = getMarketplaceGuestQuoteTestView(token);

  if (!view) {
    return (
      <main lang="sv" className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <h1 className="text-3xl font-bold text-[#17201a]">Testlänken kan inte användas</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">Den är ogiltig eller har gått ut.</p>
        </section>
      </main>
    );
  }

  return (
    <main lang="sv" className="min-h-screen bg-[#f7f7f4] px-4 py-16 text-[#17201a] sm:px-6">
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd] sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4c745a]">Proffera · Test</p>
        <h1 className="mt-3 text-3xl font-bold">Guest Quote-länken fungerar</h1>
        <p className="mt-4 leading-7 text-[#5b665f]">
          Detta är en kontrollerad e-post- och länktest. Ingen kund, offertförfrågan, företagsprofil eller avregistrering har skapats eller ändrats.
        </p>
        <dl className="mt-7 rounded-2xl bg-[#f7f9f7] p-5 text-sm">
          <div className="grid gap-1 sm:grid-cols-[11rem_1fr]"><dt className="font-bold">Testets giltighet</dt><dd>{new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(new Date(view.expiresAt))}</dd></div>
        </dl>
      </section>
    </main>
  );
}
