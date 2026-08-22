import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getMarketplaceServiceJobForCustomerToken } from "@/lib/marketplace-service-jobs";

export default async function MarketplaceCustomerComparisonLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ token: string }>;
}>) {
  const { token } = await params;
  const job = await getMarketplaceServiceJobForCustomerToken(token);
  if (job) redirect(`/offert/jobb/kund/${encodeURIComponent(token)}`);
  return children;
}
