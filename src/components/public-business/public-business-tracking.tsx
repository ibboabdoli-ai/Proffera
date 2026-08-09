"use client";

import { useEffect, type MouseEvent, type ReactNode } from "react";

type EventKey = "business_view" | "service_view" | "book_clicked" | "quote_clicked" | "contact_clicked";

function sessionKey() {
  const storageKey = "proffera-public-business-session";
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const value = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(storageKey, value);
    return value;
  } catch {
    return "";
  }
}

function sendEvent(workspaceId: string, eventKey: EventKey, serviceId?: string) {
  const payload = JSON.stringify({
    workspaceId,
    serviceId: serviceId || null,
    eventKey,
    path: window.location.pathname,
    sessionKey: sessionKey(),
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
  function track(_: MouseEvent<HTMLAnchorElement>) {
    sendEvent(workspaceId, eventKey, serviceId);
  }
  return <a href={href} onClick={track} className={className}>{children}</a>;
}
