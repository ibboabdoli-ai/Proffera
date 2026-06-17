"use client";

import { type FormEvent, useState } from "react";

const GENERIC_LOGIN_ERROR = "Det gick inte att logga in. Kontrollera uppgifterna och försök igen.";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          rememberMe: true,
        }),
      });

      const result = (await response.json().catch(() => null)) as {
        token?: string;
        user?: { email?: string };
        error?: unknown;
      } | null;

      if (!response.ok || result?.error || (!result?.token && !result?.user?.email)) {
        setErrorMessage(GENERIC_LOGIN_ERROR);
        setIsPending(false);
        return;
      }

      window.location.assign("/dashboard");
    } catch {
      setErrorMessage(GENERIC_LOGIN_ERROR);
      setIsPending(false);
    }
  }

  return (
    <aside className="w-full rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd] sm:p-8">
      <div className="inline-flex rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#17452f]">
        Kundinloggning
      </div>

      <h2 className="mt-5 text-2xl font-bold text-[#17201a]">Logga in</h2>
      <p className="mt-3 text-sm leading-7 text-[#5b665f]">
        Använd e-post och lösenord för ditt Proffera-konto.
      </p>

      <form className="mt-6 grid gap-5" onSubmit={handleSubmit} aria-describedby="login-help login-error">
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-[#17201a]">
            E-post
          </label>
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
            className="mt-2 w-full rounded-2xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] placeholder:text-[#8a958d] transition focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:cursor-not-allowed disabled:bg-[#f7f7f4] disabled:opacity-80"
          />
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-semibold text-[#17201a]">
            Lösenord
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isPending}
            placeholder="••••••••"
            className="mt-2 w-full rounded-2xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] placeholder:text-[#8a958d] transition focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:cursor-not-allowed disabled:bg-[#f7f7f4] disabled:opacity-80"
          />
        </div>

        {errorMessage ? (
          <p id="login-error" className="rounded-2xl bg-[#fff4f2] px-4 py-3 text-sm leading-6 text-[#8a2f1f]" role="alert">
            {errorMessage}
          </p>
        ) : (
          <p id="login-error" className="sr-only">
            Inga inloggningsfel.
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex w-full items-center justify-center rounded-full bg-[#17452f] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Loggar in..." : "Logga in"}
        </button>
      </form>

      <p id="login-help" className="mt-4 text-xs leading-6 text-[#6a756e]">
        Logga in via www.proffera.se för bästa stöd med kundportalen.
      </p>
    </aside>
  );
}
