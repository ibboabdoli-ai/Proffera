import { Suspense, type ReactNode } from "react";

import { MarketplaceRouteFunnelSignal } from "@/components/analytics/marketplace-route-funnel-signal";
import { getMarketplaceCustomerComparison } from "@/lib/marketplace-customer-comparison";

export default async function MarketplaceCustomerJobLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ token: string }>;
}>) {
  const { token } = await params;
  const comparison = await getMarketplaceCustomerComparison(token);
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <MarketplaceRouteFunnelSignal
          parameter="status"
          value="selected"
          event="marketplace_customer_selection_completed"
          enabled={Boolean(comparison?.selectedOfferId)}
        />
      </Suspense>
    </>
  );
}
