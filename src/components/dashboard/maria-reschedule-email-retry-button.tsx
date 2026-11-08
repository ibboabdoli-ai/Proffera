"use client";

import { useFormStatus } from "react-dom";

/** Prevent double-clicks on explicit notification retry. */
export function MariaRescheduleEmailRetryButton({ isEnglish }: { isEnglish: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending}
      className="rounded-control border border-[#bfa1a9] bg-white px-4 py-2.5 text-sm font-semibold text-[#754b5a] disabled:cursor-wait disabled:opacity-60">
      {pending ? isEnglish ? "Sending..." : "Skickar..."
        : isEnglish ? "Retry missing email only" : "Skicka om enbart uteblivet mejl"}
    </button>
  );
}
