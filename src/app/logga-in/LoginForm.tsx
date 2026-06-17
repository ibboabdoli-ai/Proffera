"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

const GENERIC_LOGIN_ERROR = "Det gick inte att logga in. Kontrollera uppgifterna och försök igen.";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPending) {
      return;
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/dashboard",
        rememberMe: true,
      });

      if (error) {
        setErrorMessage(GENERIC_LOGIN_ERROR);
        setIsPending(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage(GENERIC_LOGIN_ERROR);
      setIsPending(false);
    }
  }

  return (
    <aside className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd] sm:p-8">
      <div className="inline-flex rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#17452f]">
        Kundinloggning
      </div>

      <h2 className="mt-5 text-2xl font-bold text-[#17201a]">Logga in</h2>
      <p className="mt-3 text-sm leading-7 text-[#5b665f]">
        Logga in med din e-post och ditt lösenord. Åtkomst till kundportalen öppnas för konton med aktiv behörighet.
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
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isPending}
            placeholder="namn@foretag.se"
            className="mt-2 w-full rounded-2xl border border-[#d7ded5] bg-white px-4 py-3 text-sm text-[#17201a] placeholder:text-[#8a958d] transition focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:cursor-not-allowed disabled:bg-[#f7f7f4] disabled:opacity-80"
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
            className="mt-2 w-full rounded-2xl border border-[#d7ded5] bg-white px-4 py-3 text-sm text-[#17201a] placeholder:text-[#8a958d] transition focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:cursor-not-allowed disabled:bg-[#f7f7f4] disabled:opacity-80"
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
          className="inline-flex w-full items-center justify-center rounded-full bg-[#17452f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Loggar in..." : "Logga in"}
        </button>
      </form>

      <p id="login-help" className="mt-4 text-xs leading-6 text-[#6a756e]">
        Inloggning är för Proffera-kunder med aktivt konto. Basic Auth och dashboard-skydd ändras inte i denna fas.
      </p>
    </aside>
  );
}
