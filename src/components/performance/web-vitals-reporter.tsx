"use client";

import { useReportWebVitals } from "next/web-vitals";

import { classifyWebVitalRoute } from "@/lib/web-vitals-route";

const SAMPLE_RATE = 0.2;
const SAMPLE_STORAGE_KEY = "proffera:web-vitals-sample:v1";

type WebVitalMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

let fallbackSampled: boolean | undefined;

function shouldSample() {
  try {
    const stored = window.sessionStorage.getItem(SAMPLE_STORAGE_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;

    const sampled = Math.random() < SAMPLE_RATE;
    window.sessionStorage.setItem(SAMPLE_STORAGE_KEY, sampled ? "1" : "0");
    return sampled;
  } catch {
    fallbackSampled ??= Math.random() < SAMPLE_RATE;
    return fallbackSampled;
  }
}

function sendMetric(metric: WebVitalMetric) {
  if (process.env.NODE_ENV !== "production" || !shouldSample()) return;

  const payload = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    routeGroup: classifyWebVitalRoute(window.location.pathname),
    navigationType: metric.navigationType ?? "unknown",
  });

  const blob = new Blob([payload], { type: "application/json" });
  if (navigator.sendBeacon?.("/api/observability/web-vitals", blob)) return;

  void fetch("/api/observability/web-vitals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

export function WebVitalsReporter() {
  useReportWebVitals(sendMetric);
  return null;
}
