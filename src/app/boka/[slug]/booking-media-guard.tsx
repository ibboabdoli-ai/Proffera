"use client";

import { useEffect } from "react";

export function BookingMediaGuard() {
  useEffect(() => {
    const hideFailedMedia = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement) && !(target instanceof HTMLVideoElement)) return;
      if (!target.closest("[data-booking-theme] > main:first-child > section:first-child")) return;
      target.style.display = "none";
      target.setAttribute("aria-hidden", "true");
    };

    document.addEventListener("error", hideFailedMedia, true);
    return () => document.removeEventListener("error", hideFailedMedia, true);
  }, []);

  return null;
}
