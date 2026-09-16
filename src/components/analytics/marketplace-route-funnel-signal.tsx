"use client";

import { useSearchParams } from "next/navigation";

import { MarketplaceFunnelSignal } from "@/components/analytics/marketplace-funnel-signal";
import type { MarketplaceFunnelEventName } from "@/lib/analytics/marketplace-funnel-events";

export function MarketplaceRouteFunnelSignal({
  parameter,
  value,
  event,
  properties,
}: {
  parameter: string;
  value: string;
  event: MarketplaceFunnelEventName;
  properties?: Record<string, unknown>;
}) {
  const searchParams = useSearchParams();
  if (searchParams.get(parameter) !== value) return null;
  const locale = searchParams.get("lang") === "en" ? "en" : "sv";
  return (
    <MarketplaceFunnelSignal
      event={event}
      properties={{ ...properties, locale }}
      stripSearchParams={[parameter]}
    />
  );
}
