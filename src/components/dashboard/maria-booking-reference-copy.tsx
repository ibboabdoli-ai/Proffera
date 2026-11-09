"use client";

import { useState } from "react";

type Props = { reference: string; isEnglish: boolean; language?: "sv" | "en" | "ar"; kind?: "booking" | "swish" };

/** Copies display-only booking or Swish numbers; never changes a payment. */
export function MariaBookingReferenceCopy({ reference, isEnglish, language, kind = "booking" }: Props) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);
  const locale = language ?? (isEnglish ? "en" : "sv");
  const labels = {
    sv: { swish: "Kopiera Swish-nummer", booking: "Kopiera bokningsnummer", copy: "Kopiera", copied: "Kopierat!", failed: "Markera numret och kopiera." },
    en: { swish: "Copy Swish number", booking: "Copy booking number", copy: "Copy", copied: "Copied!", failed: "Select the number to copy." },
    ar: { swish: "نسخ رقم Swish", booking: "نسخ رقم الحجز", copy: "نسخ", copied: "تم النسخ!", failed: "حددي الرقم وانسخيه يدويًا." },
  }[locale];

  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(reference);
      setResult("copied");
    } catch {
      setResult("failed");
    }
  }

  return (
    <span className="inline-flex min-h-10 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={kind === "swish" ? labels.swish : labels.booking}
        className="min-h-10 rounded-lg border border-[#845363] bg-white px-3 py-2 text-xs font-bold text-[#704858] hover:bg-[#fcf0f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#845363]"
      >
        {labels.copy}
      </button>
      <span role="status" aria-live="polite" className="text-xs font-semibold text-[#704858]">
        {result === "copied" ? labels.copied : result === "failed" ? labels.failed : ""}
      </span>
    </span>
  );
}
