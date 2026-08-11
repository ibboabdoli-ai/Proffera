"use client";

import { type FormEvent, useState } from "react";

export function PreviewAdminSetupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || created) return;

    const normalizedEmail = email.trim().toLowerCase();
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim() || normalizedEmail,
          email: normalizedEmail,
          password,
        }),
      });

      const result = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok || result?.error) {
        setErrorMessage("Det gick inte att skapa Preview-kontot. Kontrollera uppgifterna och försök igen.");
        setIsPending(false);
        return;
      }

      setPassword("");
      setCreated(true);
      setIsPending(false);
    } catch {
      setErrorMessage("Det gick inte att skapa Preview-kontot. Försök igen.");
      setIsPending(false);
    }
  }

  if (created) {
    return (
      <div className="mt-6 rounded-xl border border-[#b8d9c2] bg-[#eef8f0] px-4 py-4 text-sm leading-6 text-[#17452f]" role="status">
        <p className="font-semibold">Preview-kontot är skapat.</p>
        <p className="mt-1">Gå tillbaka till chatten och skriv <strong>klart</strong>. Adminbehörigheten aktiveras separat i Preview-databasen.</p>
      </div>
    );
  }

  return (
    <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="preview-name" className="text-sm font-semibold text-[#17201a]">Namn</label>
        <input id="preview-name" type="text" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} disabled={isPending} className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:opacity-70" />
      </div>
      <div>
        <label htmlFor="preview-email" className="text-sm font-semibold text-[#17201a]">E-post</label>
        <input id="preview-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={isPending} className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:opacity-70" />
      </div>
      <div>
        <label htmlFor="preview-password" className="text-sm font-semibold text-[#17201a]">Nytt lösenord för Preview</label>
        <input id="preview-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={isPending} className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:opacity-70" />
        <p className="mt-2 text-xs leading-5 text-[#6a756e]">Minst 8 tecken. Använd gärna ett separat lösenord för Preview.</p>
      </div>
      {errorMessage ? <p className="rounded-xl bg-[#fff4f2] px-4 py-3 text-sm leading-6 text-[#8a2f1f]" role="alert">{errorMessage}</p> : null}
      <button type="submit" disabled={isPending} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#17452f] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70">
        {isPending ? "Skapar konto..." : "Skapa Preview-konto"}
      </button>
    </form>
  );
}
