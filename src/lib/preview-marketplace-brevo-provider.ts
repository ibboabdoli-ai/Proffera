import "server-only";

import { resolveBrevoApiKey } from "@/lib/email-runtime-config";
import { isPreviewMarketplaceE2eRuntime } from "@/lib/preview-marketplace-e2e";

export type PreviewMarketplaceBrevoProviderStatus =
  | "accepted"
  | "queued"
  | "delivered"
  | "delayed"
  | "blocked"
  | "bounced"
  | "rejected"
  | "suppressed"
  | "not_found";

type BrevoEvent = {
  event?: string;
  messageId?: string;
  reason?: string;
};

type BrevoEventReport = {
  events?: BrevoEvent[];
};

export type PreviewMarketplaceBrevoProviderObservation = {
  status: PreviewMarketplaceBrevoProviderStatus;
  events: string[];
  reason: string | null;
};

const RETRY_DELAYS_MS = [0, 750, 1_750, 3_500] as const;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizedEvent(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function sanitizeReason(value: unknown) {
  const reason = String(value ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[redacted-email]")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return reason ? reason.slice(0, 300) : null;
}

function classify(events: BrevoEvent[]): PreviewMarketplaceBrevoProviderObservation {
  const names = events.map((event) => normalizedEvent(event.event)).filter(Boolean);
  const has = (...values: string[]) => values.some((value) => names.includes(value));
  const reason = sanitizeReason(events.find((event) => sanitizeReason(event.reason))?.reason);

  let status: PreviewMarketplaceBrevoProviderStatus = "not_found";
  if (has("delivered", "opened", "click", "clicked", "firstopening", "proxyopen", "uniqueproxyopen")) {
    status = "delivered";
  } else if (has("blocked")) {
    status = "blocked";
  } else if (has("hardbounce", "hardbounces", "softbounce", "softbounces", "bounce", "bounced")) {
    status = "bounced";
  } else if (has("invalid", "invalidemail", "error", "rejected")) {
    status = "rejected";
  } else if (has("unsubscribed", "spam", "complaint", "suppressed")) {
    status = "suppressed";
  } else if (has("deferred", "delayed")) {
    status = "delayed";
  } else if (has("queued", "queue")) {
    status = "queued";
  } else if (has("request", "sent", "accepted")) {
    status = "accepted";
  }

  return {
    status,
    events: [...new Set(names)],
    reason,
  };
}

async function fetchEvents(messageId: string, apiKey: string): Promise<BrevoEvent[] | null> {
  const url = new URL("https://api.brevo.com/v3/smtp/statistics/events");
  url.searchParams.set("messageId", messageId);
  url.searchParams.set("days", "1");
  url.searchParams.set("limit", "50");
  url.searchParams.set("sort", "desc");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "api-key": apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const body = await response.json() as BrevoEventReport;
    return (body.events ?? []).filter((event) => String(event.messageId ?? "").trim() === messageId);
  } catch {
    return null;
  }
}

export async function inspectPreviewMarketplaceBrevoTransaction(
  messageIdInput: string | null | undefined,
): Promise<PreviewMarketplaceBrevoProviderObservation | null> {
  if (!isPreviewMarketplaceE2eRuntime()) return null;
  const messageId = String(messageIdInput ?? "").trim();
  const apiKey = resolveBrevoApiKey();
  if (!messageId || !apiKey) return null;

  let latest: PreviewMarketplaceBrevoProviderObservation = {
    status: "not_found",
    events: [],
    reason: null,
  };

  for (const waitMs of RETRY_DELAYS_MS) {
    if (waitMs) await delay(waitMs);
    const events = await fetchEvents(messageId, apiKey);
    if (!events) continue;
    latest = classify(events);
    if (["delivered", "blocked", "bounced", "rejected", "suppressed"].includes(latest.status)) {
      break;
    }
  }

  return latest;
}
