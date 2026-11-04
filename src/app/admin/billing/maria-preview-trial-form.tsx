"use client";

import { useFormStatus } from "react-dom";
import { startMariaPreviewTrialAction } from "./actions";

function StartButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Aktiverar..." : "Starta 14 dagar gratis (Preview)"}
    </button>
  );
}

/** Only rendered in Preview for an unbilled Maria workspace; server rechecks all gates. */
export function MariaPreviewTrialForm({ workspaceId }: { workspaceId: string }) {
  return (
    <form
      action={startMariaPreviewTrialAction}
      className="mt-3 grid min-w-64 gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3"
    >
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <label className="grid gap-1 text-xs font-semibold text-amber-950">
        Anledning (obligatorisk)
        <textarea
          name="reason"
          required
          minLength={8}
          maxLength={500}
          rows={2}
          placeholder="Intern test av Marias bokningskalender"
          className="rounded-lg border border-amber-300 bg-white px-2 py-2 font-normal text-slate-900"
        />
      </label>
      <p className="text-xs text-amber-900">
        Bara Makeup by Maria i isolerad Preview. Ingen Stripe-betalning eller
        prenumeration skapas. Den här första testperioden kan bara startas en gång.
      </p>
      <StartButton />
    </form>
  );
}
