"use client";
import { useState } from "react";

export function BookingSoftDeleteControl({ bookingId, action, en }: {
  bookingId: string; action: "hide" | "restore"; en: boolean;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <section className="rounded-card border border-line bg-surface p-5">
    <h3 className="font-semibold">{action === "hide"
      ? en ? "Move completed booking to archive" : "Arkivera avslutad bokning"
      : en ? "Restore booking" : "Återställ bokning"}</h3>
    <p className="mt-2 text-sm text-ink-muted">{action === "hide"
      ? en ? "Only closed bookings can be archived. This does not cancel a booking, refund a deposit, or remove payment/audit records."
        : "Endast avslutade bokningar kan arkiveras. Detta avbokar inte, återbetalar inte handpenning och tar inte bort betalningshistorik."
      : en ? "Restore the booking to the normal dashboard without changing payment or status."
        : "Återställ bokningen i listan utan att ändra betalning eller status."}</p>
    <form className="mt-4 grid gap-3" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      try {
        const res = await fetch("/api/dashboard/bokningar/soft-delete", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, action, confirmation, acknowledged: checked }),
        });
        const data = await res.json() as { updated?: boolean; error?: string };
        if (!res.ok) throw Error(data.error || "Request failed");
        window.location.assign(action === "hide" ? "/dashboard/bokningar" : "/dashboard/bokningar/arkiv");
      } catch (error) { setError(error instanceof Error ? error.message : "Request failed"); }
      finally { setBusy(false); }
    }}>
      <label className="grid gap-1 text-sm">{en ? "Type the exact booking ID:" : "Skriv exakt boknings-ID:"}
        <code className="break-all text-xs">{bookingId}</code>
        <input required autoComplete="off" className="rounded-control border border-line px-3 py-2"
          value={confirmation} onChange={event => setConfirmation(event.target.value)} />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input required type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />
        {en ? "I understand that payment and audit records remain unchanged."
          : "Jag förstår att betalnings- och revisionshistorik bevaras."}
      </label>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <button disabled={!checked || confirmation !== bookingId || busy}
        className="w-fit rounded-control border border-line px-4 py-2 font-semibold" type="submit">
        {busy ? "..." : action === "hide" ? en ? "Archive booking" : "Arkivera bokning"
          : en ? "Restore" : "Återställ"}
      </button>
    </form>
  </section>;
}
