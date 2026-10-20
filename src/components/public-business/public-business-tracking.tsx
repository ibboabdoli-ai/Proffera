"use client";

import { useEffect, type ReactNode } from "react";

type EventKey = "business_view" | "service_view" | "book_clicked" | "quote_clicked" | "contact_clicked";

export function sessionKey() {
  const storageKey = "proffera-public-business-session";
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    // Use cryptographically strong randomness; never Math.random.
    const crypto = window.crypto;
    const value = crypto?.randomUUID?.() ?? (crypto?.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("")
      : "");
    if (!value) return "";
    window.sessionStorage.setItem(storageKey, value);
    return value;
  } catch {
    return "";
  }
}

function sendEvent(workspaceId: string, eventKey: EventKey, serviceId?: string) {
  const visitorSessionKey = sessionKey();
  // When secure randomness or session storage is unavailable, fail closed
  // rather than merging unrelated visitors into an anonymous event bucket.
  if (!visitorSessionKey) return;
  const payload = JSON.stringify({
    workspaceId,
    serviceId: serviceId || null,
    eventKey,
    path: window.location.pathname,
    sessionKey: visitorSessionKey,
    referrer: document.referrer || "",
  });
  void fetch("/api/public-business/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export function PublicBusinessViewEvent({ workspaceId, serviceId }: { workspaceId: string; serviceId?: string }) {
  useEffect(() => {
    sendEvent(workspaceId, serviceId ? "service_view" : "business_view", serviceId);
  }, [workspaceId, serviceId]);
  return null;
}

export function PublicBusinessTrackedLink({
  workspaceId,
  serviceId,
  eventKey,
  href,
  className,
  children,
}: {
  workspaceId: string;
  serviceId?: string;
  eventKey: Exclude<EventKey, "business_view" | "service_view">;
  href: string;
  className?: string;
  children: ReactNode;
}) {
  function track() {
    sendEvent(workspaceId, eventKey, serviceId);
  }
  return <a href={href} onClick={track} className={className}>{children}</a>;
}
