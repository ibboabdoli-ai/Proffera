"use client";

import { type FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";

const genericError = "Lösenordet kunde inte ändras. Kontrollera ditt nuvarande lösenord och försök igen.";

export function AccountSecurityCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    if (newPassword.length < 8) {
      setIsError(true);
      setMessage("Det nya lösenordet behöver vara minst 8 tecken.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setIsError(true);
      setMessage("De nya lösenorden matchar inte.");
      return;
    }

    setIsPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions: true }),
      });

      if (!response.ok) {
        setIsError(true);
        setMessage(genericError);
        setIsPending(false);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsError(false);
      setMessage("Lösenordet ändrades. Andra inloggade enheter har loggats ut.");
    } catch {
      setIsError(true);
      setMessage(genericError);
    }

    setIsPending(false);
  }

  const inputClass = "min-h-11 rounded-control border border-line bg-surface px-4 py-3 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand/15";

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="account-security-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-[#e9f2ec] text-brand">
          <KeyRound className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand">Kontosäkerhet</p>
          <h2 id="account-security-title" className="mt-1 text-xl font-bold tracking-tight text-ink">Byt lösenord</h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">Använd minst 8 tecken. När lösenordet ändras loggas andra enheter ut.</p>
        </div>
      </div>

      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-semibold text-ink-muted sm:col-span-2">Nuvarande lösenord
          <input className={inputClass} type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={isPending} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink-muted">Nytt lösenord
          <input className={inputClass} type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={isPending} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-ink-muted">Bekräfta nytt lösenord
          <input className={inputClass} type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isPending} />
        </label>
        {message ? <p role={isError ? "alert" : "status"} className={`rounded-control px-4 py-3 text-sm font-semibold sm:col-span-2 ${isError ? "border border-[#f4c7ba] bg-[#fff5f2] text-danger" : "border border-[#cfe8d6] bg-[#eaf8f2] text-[#087754]"}`}>{message}</p> : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={isPending} className="inline-flex min-h-11 items-center justify-center rounded-control bg-[#17452f] px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-hover focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70">
            {isPending ? "Sparar..." : "Byt lösenord"}
          </button>
        </div>
      </form>
    </section>
  );
}
