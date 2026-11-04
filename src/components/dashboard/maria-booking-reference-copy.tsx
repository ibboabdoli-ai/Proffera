"use client";

import { useState } from "react";

type Props = { reference: string; isEnglish: boolean; kind?: "booking" | "swish" };

/** Copies display-only booking or Swish numbers; never changes a payment. */
export function MariaBookingReferenceCopy({ reference, isEnglish, kind = "booking" }: Props) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null);

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
        aria-label={kind === "swish"
          ? isEnglish ? "Copy Swish number" : "Kopiera Swish-nummer"
          : isEnglish ? "Copy booking number" : "Kopiera bokningsnummer"}
        className="min-h-10 rounded-lg border border-[#845363] bg-white px-3 py-2 text-xs font-bold text-[#704858] hover:bg-[#fcf0f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#845363]"
      >
        {isEnglish ? "Copy" : "Kopiera"}
      </button>
      <span role="status" aria-live="polite" className="text-xs font-semibold text-[#704858]">
        {result === "copied" ? (isEnglish ? "Copied!" : "Kopierat!") :
          result === "failed" ? (isEnglish ? "Select the number to copy." : "Markera numret och kopiera.") : ""}
      </span>
    </span>
  );
}
