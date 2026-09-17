import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";

import { MarketplaceRouteFunnelSignal } from "@/components/analytics/marketplace-route-funnel-signal";
import { getMarketplaceGuestQuoteView } from "@/lib/marketplace-guest-quote-human-view";
import { getMarketplaceServiceJobForGuestToken } from "@/lib/marketplace-service-jobs";

const INVITATION_DELIVERED_STATES = new Set(["sent", "viewed", "responded"]);

export default async function MarketplaceGuestQuoteLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ token: string }>;
}>) {
  const { token } = await params;
  const [job, quote] = await Promise.all([
    getMarketplaceServiceJobForGuestToken(token),
    getMarketplaceGuestQuoteView(token),
  ]);
  if (job) redirect(`/offert/jobb/${encodeURIComponent(token)}`);

  const invitationPersisted = Boolean(quote && INVITATION_DELIVERED_STATES.has(quote.status));
  const offerPersisted = Boolean(quote?.offer?.submittedAt);

  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MarketplaceRouteFunnelSignal
          parameter="source"
          value="invitation"
          event="marketplace_invitation_outcome"
          properties={{ outcome: "invited" }}
          enabled={invitationPersisted}
        />
        <MarketplaceRouteFunnelSignal
          parameter="status"
          value="sent"
          event="marketplace_provider_offer_submitted"
          enabled={offerPersisted}
        />
      </Suspense>
    </>
  );
}
