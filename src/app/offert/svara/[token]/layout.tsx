import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { MarketplaceRouteFunnelSignal } from "@/components/analytics/marketplace-route-funnel-signal";
import { getMarketplaceServiceJobForGuestToken } from "@/lib/marketplace-service-jobs";

export default async function MarketplaceGuestQuoteLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ token: string }>;
}>) {
  const { token } = await params;
  const job = await getMarketplaceServiceJobForGuestToken(token);
  if (job) redirect(`/offert/jobb/${encodeURIComponent(token)}`);
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MarketplaceRouteFunnelSignal
          parameter="source"
          value="invitation"
          event="marketplace_invitation_outcome"
          properties={{ outcome: "invited" }}
        />
        <MarketplaceRouteFunnelSignal
          parameter="status"
          value="sent"
          event="marketplace_provider_offer_submitted"
        />
      </Suspense>
    </>
  );
}
