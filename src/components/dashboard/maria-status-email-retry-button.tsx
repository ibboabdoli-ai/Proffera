"use client";

import { useFormStatus } from "react-dom";

/** Prevent accidental double clicks while the server action is pending.
 * The manager may explicitly retry again after failure or page reload. */
export function MariaStatusEmailRetryButton({ isEnglish }: { isEnglish: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      aria-disabled={pending}
      className="rounded-control border border-[#bfa1a9] bg-white px-4 py-2.5 text-sm font-semibold text-[#754b5a] disabled:cursor-wait disabled:opacity-60">
      {pending
        ? isEnglish ? "Sending..." : "Skickar..."
        : isEnglish ? "Resend to approved QA inbox" : "Skicka om till godkänd QA-inkorg"}
    </button>
  );
}
