"use client";

import { useFormStatus } from "react-dom";

import { TRIAL_EXTENSION_DAY_OPTIONS } from "@/lib/admin-billing-policy";
import { extendTrialAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Förlänger…" : "Förläng trial"}
    </button>
  );
}

export function TrialExtensionForm({
  workspaceId,
  workspacePlanId,
  currentPeriodEnd,
}: {
  workspaceId: string;
  workspacePlanId: string;
  currentPeriodEnd: string;
}) {
  return (
    <form action={extendTrialAction} className="mt-3 grid min-w-64 gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="workspacePlanId" value={workspacePlanId} />
      <input type="hidden" name="expectedCurrentPeriodEnd" value={currentPeriodEnd} />
      <label className="grid gap-1 text-xs font-semibold text-amber-950">
        Antal dagar
        <select name="days" defaultValue="7" className="rounded-lg border border-amber-300 bg-white px-2 py-2 font-normal text-slate-900">
          {TRIAL_EXTENSION_DAY_OPTIONS.map((days) => (
            <option key={days} value={days}>{days} dagar</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-semibold text-amber-950">
        Obligatorisk anledning
        <textarea
          name="reason"
          required
          minLength={8}
          maxLength={500}
          rows={3}
          placeholder="Beskriv varför trialperioden förlängs"
          className="rounded-lg border border-amber-300 bg-white px-2 py-2 font-normal text-slate-900"
        />
      </label>
      <p className="text-[11px] leading-4 text-amber-800">Endast interna trialperioder. Stripe-hanterade abonnemang blockeras på serversidan.</p>
      <SubmitButton />
    </form>
  );
}
