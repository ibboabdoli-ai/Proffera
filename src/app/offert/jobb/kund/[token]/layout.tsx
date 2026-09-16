import { Suspense, type ReactNode } from "react";

import { MarketplaceRouteFunnelSignal } from "@/components/analytics/marketplace-route-funnel-signal";

export default function MarketplaceCustomerJobLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MarketplaceRouteFunnelSignal
          parameter="status"
          value="selected"
          event="marketplace_customer_selection_completed"
        />
      </Suspense>
    </>
  );
}
