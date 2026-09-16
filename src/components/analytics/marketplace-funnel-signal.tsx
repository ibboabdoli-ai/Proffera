"use client";

import { useEffect, useRef } from "react";

import {
  MARKETPLACE_FUNNEL_BROWSER_EVENT,
  sanitizeMarketplaceFunnelEventInput,
  type MarketplaceFunnelEventInput,
  type MarketplaceFunnelEventName,
} from "@/lib/analytics/marketplace-funnel-events";

export function emitMarketplaceFunnelEvent(input: MarketplaceFunnelEventInput) {
  if (typeof window === "undefined") return false;
  const sanitized = sanitizeMarketplaceFunnelEventInput(input);
  if (!sanitized) return false;
  window.dispatchEvent(new CustomEvent(MARKETPLACE_FUNNEL_BROWSER_EVENT, { detail: sanitized }));
  return true;
}

function stripSearchParameters(parameters: readonly string[]) {
  if (!parameters.length) return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const parameter of parameters) {
    if (!url.searchParams.has(parameter)) continue;
    url.searchParams.delete(parameter);
    changed = true;
  }
  if (!changed) return;
  const query = url.searchParams.toString();
  window.history.replaceState(null, "", `${url.pathname}${query ? `?${query}` : ""}${url.hash}`);
}

export function MarketplaceFunnelSignal({
  event,
  properties,
  stripSearchParams = [],
}: {
  event: MarketplaceFunnelEventName;
  properties?: Record<string, unknown>;
  stripSearchParams?: readonly string[];
}) {
  const emitted = useRef(false);

  useEffect(() => {
    if (emitted.current) return;
    const timer = window.setTimeout(() => {
      if (emitted.current) return;
      emitted.current = true;
      emitMarketplaceFunnelEvent({ event, properties });
      stripSearchParameters(stripSearchParams);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [event, properties, stripSearchParams]);

  return null;
}
