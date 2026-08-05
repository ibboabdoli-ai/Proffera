import { updateWorkspaceContactAction } from "./actions";

export function ContactEditForm({
  sessionId,
  contactEmail,
  contactPhone,
  primaryCity,
}: {
  sessionId: string;
  contactEmail: string;
  contactPhone: string;
  primaryCity: string;
}) {
  return (
    <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-red-700">Edit mode</p>
        <h2 className="mt-1 text-lg font-bold text-slate-950">Redigera kontaktuppgifter</h2>
        <p className="mt-2 text-sm text-slate-600">
          Endast dessa tre fält kan ändras i den här versionen. Ändringen loggas med tidigare och nya värden.
        </p>
      </div>
      <form action={updateWorkspaceContactAction} className="mt-5 grid gap-4 sm:grid-cols-3">
        <input type="hidden" name="sessionId" value={sessionId} />
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Ort
          <input className="rounded-lg border border-slate-300 px-3 py-2 font-normal" name="primaryCity" defaultValue={primaryCity} maxLength={160} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          E-post
          <input className="rounded-lg border border-slate-300 px-3 py-2 font-normal" name="contactEmail" type="email" defaultValue={contactEmail} maxLength={320} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Telefon
          <input className="rounded-lg border border-slate-300 px-3 py-2 font-normal" name="contactPhone" defaultValue={contactPhone} maxLength={80} />
        </label>
        <div className="sm:col-span-3">
          <button type="submit" className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">
            Spara loggad ändring
          </button>
        </div>
      </form>
    </section>
  );
}
