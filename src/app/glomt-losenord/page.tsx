"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/aterstall-losenord`,
        }),
      });

      if (!response.ok) {
        setErrorMessage("Det gick inte att skicka återställningslänken. Försök igen.");
        setIsPending(false);
        return;
      }

      setMessage("Om kontot finns skickar vi en återställningslänk via e-post.");
      setIsPending(false);
    } catch {
      setErrorMessage("Det gick inte att skicka återställningslänken. Försök igen.");
      setIsPending(false);
    }
  }

  return (
    <main className="min-h-[70vh] bg-[#f7f7f4] px-4 py-14 sm:px-6">
      <section className="mx-auto w-full max-w-lg rounded-[1.75rem] border border-[#dfe5dd] bg-white p-6 shadow-xl shadow-[#17452f]/10 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]">Proffera</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[#17201a]">Glömt lösenord?</h1>
        <p className="mt-3 text-sm leading-7 text-[#5b665f]">
          Ange e-postadressen för ditt Proffera-konto. Om kontot finns skickar vi en säker länk för att välja ett nytt lösenord.
        </p>

        <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="text-sm font-semibold text-[#17201a]">E-post</label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isPending}
              placeholder="namn@foretag.se"
              className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] placeholder:text-[#8a958d] transition focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:cursor-not-allowed disabled:bg-[#f7f7f4] disabled:opacity-80"
            />
          </div>

          {message ? <p className="rounded-xl bg-[#eef5ef] px-4 py-3 text-sm leading-6 text-[#17452f]" role="status">{message}</p> : null}
          {errorMessage ? <p className="rounded-xl bg-[#fff4f2] px-4 py-3 text-sm leading-6 text-[#8a2f1f]" role="alert">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#17452f] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Skickar..." : "Skicka återställningslänk"}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#5b665f]">
          <Link href="/logga-in?lang=sv" className="font-semibold text-[#17452f] hover:underline">Tillbaka till inloggningen</Link>
        </p>
      </section>
    </main>
  );
}
