import type { ReactNode } from "react";
import { redirect } from "next/navigation";

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
  return children;
}
