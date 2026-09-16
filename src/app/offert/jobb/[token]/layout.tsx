import { Suspense, type ReactNode } from "react";

import { MarketplaceRouteFunnelSignal } from "@/components/analytics/marketplace-route-funnel-signal";
import { getMarketplaceServiceJobForGuestToken } from "@/lib/marketplace-service-jobs";

export default async function MarketplaceProviderJobLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ token: string }>;
}>) {
  const { token } = await params;
  const job = await getMarketplaceServiceJobForGuestToken(token);
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MarketplaceRouteFunnelSignal
          parameter="job"
          value="completed"
          event="marketplace_service_job_completed"
          enabled={job?.status === "completed"}
        />
      </Suspense>
    </>
  );
}
