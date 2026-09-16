import { Suspense, type ReactNode } from "react";

import { MarketplaceRouteFunnelSignal } from "@/components/analytics/marketplace-route-funnel-signal";

export default function MarketplaceProviderJobLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MarketplaceRouteFunnelSignal
          parameter="job"
          value="completed"
          event="marketplace_service_job_completed"
        />
      </Suspense>
    </>
  );
}
