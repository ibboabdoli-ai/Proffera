"use client";

import { useEffect } from "react";

const PLAN_LABELS: Record<string, "starter" | "professional"> = {
  "välj starter": "starter",
  "choose starter": "starter",
  "välj professional": "professional",
  "choose professional": "professional",
};

/**
 * Provides a native HTML form fallback for Stripe plan selection.
 * Some in-app browsers do not reliably complete the fetch + location.assign
 * checkout flow. A document-level POST lets the server redirect directly to
 * Stripe without depending on client-side fetch/navigation support.
 */
export function DashboardStripeCheckoutFix() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;

      const normalizedText = button.textContent?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
      const planEntry = Object.entries(PLAN_LABELS).find(([label]) => normalizedText.includes(label));
      if (!planEntry) return;

      const planKey = planEntry[1];
      event.preventDefault();
      event.stopImmediatePropagation();

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/stripe/checkout";
      form.style.display = "none";

      const planInput = document.createElement("input");
      planInput.type = "hidden";
      planInput.name = "planKey";
      planInput.value = planKey;
      form.appendChild(planInput);

      const localeInput = document.createElement("input");
      localeInput.type = "hidden";
      localeInput.name = "lang";
      localeInput.value = new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "sv";
      form.appendChild(localeInput);

      document.body.appendChild(form);
      form.submit();
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
