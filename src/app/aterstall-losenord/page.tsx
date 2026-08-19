"use client";

import Link from "next/link";
import { type FormEvent, useState, useSyncExternalStore } from "react";

function subscribeToLocation() {
  return () => {};
}

function useCurrentLocationHref() {
  return useSyncExternalStore(
    subscribeToLocation,
    () => window.location.href,
    () => "",
  );
}

export default function ResetPasswordPage() {
  const currentHref = useCurrentLocationHref();
  const currentUrl = currentHref ? new URL(currentHref) : null;
  const token = currentUrl?.searchParams.get("token") ?? null;
  const tokenError = Boolean(currentUrl?.searchParams.get("error")) || (Boolean(currentUrl) && !token);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !token) return;

    if (password.length < 8) {
      setErrorMessage("Lösenordet måste vara minst 8 tecken.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Lösenorden matchar inte.");
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: password, token }),
      });

      if (!response.ok) {
        setErrorMessage("Länken är ogiltig eller har gått ut. Begär en ny återställningslänk.");
        setIsPending(false);
        return;
      }

      setIsComplete(true);
      setPassword("");
      setConfirmPassword("");
      setIsPending(false);
    } catch {
      setErrorMessage("Det gick inte att återställa lösenordet. Försök igen.");
      setIsPending(false);
    }
  }

  return (
    <main className="min-h-[70vh] bg-[#f7f7f4] px-4 py-14 sm:px-6">
      <section className="mx-auto w-full max-w-lg rounded-[1.75rem] border border-[#dfe5dd] bg-white p-6 shadow-xl shadow-[#17452f]/10 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]">Proffera</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[#17201a]">Välj nytt lösenord</h1>

        {!currentUrl ? (
          <p className="mt-6 text-sm leading-6 text-[#5b665f]">Laddar återställningslänken...</p>
        ) : isComplete ? (
          <div className="mt-6">
            <p className="rounded-xl bg-[#eef5ef] px-4 py-3 text-sm leading-6 text-[#17452f]" role="status">
              Lösenordet är uppdaterat. Du kan nu logga in med ditt nya lösenord.
            </p>
            <Link href="/logga-in?lang=sv" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#17452f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#123824]">
              Gå till inloggningen
            </Link>
          </div>
        ) : tokenError ? (
          <div className="mt-6">
            <p className="rounded-xl bg-[#fff4f2] px-4 py-3 text-sm leading-6 text-[#8a2f1f]" role="alert">
              Återställningslänken är ogiltig eller har gått ut.
            </p>
            <Link href="/glomt-losenord" className="mt-5 inline-flex font-semibold text-[#17452f] hover:underline">
              Begär en ny länk
            </Link>
          </div>
        ) : (
          <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="text-sm font-semibold text-[#17201a]">Nytt lösenord</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isPending}
                className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] transition focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:cursor-not-allowed disabled:bg-[#f7f7f4] disabled:opacity-80"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="text-sm font-semibold text-[#17201a]">Bekräfta lösenord</label>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isPending}
                className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] transition focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:cursor-not-allowed disabled:bg-[#f7f7f4] disabled:opacity-80"
              />
            </div>

            {errorMessage ? <p className="rounded-xl bg-[#fff4f2] px-4 py-3 text-sm leading-6 text-[#8a2f1f]" role="alert">{errorMessage}</p> : null}

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#17452f] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Uppdaterar..." : "Spara nytt lösenord"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
