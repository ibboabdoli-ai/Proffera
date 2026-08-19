"use client";

import { type FormEvent, useState } from "react";

type LoginLocale = "sv" | "en";

type LoginFormProps = {
  afterLoginPath?: string;
  locale?: LoginLocale;
};

const copy = {
  sv: {
    genericError: "Det gick inte att logga in. Kontrollera uppgifterna och försök igen.",
    badge: "Kundinloggning",
    title: "Logga in",
    intro: "Använd e-post och lösenord för ditt Proffera-konto.",
    email: "E-post",
    emailPlaceholder: "namn@foretag.se",
    password: "Lösenord",
    forgotPassword: "Glömt lösenord?",
    idleError: "Inga inloggningsfel.",
    pending: "Loggar in...",
    submit: "Logga in",
    help: "Logga in via www.proffera.se för bästa stöd med kundportalen.",
  },
  en: {
    genericError: "We could not sign you in. Check your details and try again.",
    badge: "Customer sign-in",
    title: "Sign in",
    intro: "Use the email address and password for your Proffera account.",
    email: "Email",
    emailPlaceholder: "name@company.com",
    password: "Password",
    forgotPassword: "Forgot password?",
    idleError: "No sign-in errors.",
    pending: "Signing in...",
    submit: "Sign in",
    help: "Sign in through www.proffera.se for the best customer portal experience.",
  },
} as const;

export function LoginForm({ afterLoginPath = "/dashboard", locale = "sv" }: LoginFormProps) {
  const text = copy[locale];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    const normalizedEmail = email.trim().toLowerCase();
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: normalizedEmail, password, rememberMe: true }),
      });

      const result = (await response.json().catch(() => null)) as {
        token?: string;
        user?: { email?: string };
        error?: unknown;
      } | null;

      if (!response.ok || result?.error || (!result?.token && !result?.user?.email)) {
        setErrorMessage(text.genericError);
        setIsPending(false);
        return;
      }

      window.localStorage.setItem("proffera-locale", locale);
      document.cookie = `proffera_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
      window.location.assign(afterLoginPath);
    } catch {
      setErrorMessage(text.genericError);
      setIsPending(false);
    }
  }

  return (
    <aside className="w-full rounded-[1.75rem] border border-white bg-white p-6 shadow-2xl shadow-[#17452f]/10 ring-1 ring-[#dfe5dd] sm:p-8">
      <div className="inline-flex rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#17452f]">{text.badge}</div>
      <h2 className="mt-5 text-2xl font-bold text-[#17201a]">{text.title}</h2>
      <p className="mt-3 text-sm leading-7 text-[#5b665f]">{text.intro}</p>

      <form className="mt-6 grid gap-5" onSubmit={handleSubmit} aria-describedby="login-help login-error">
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-[#17201a]">{text.email}</label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={isPending} placeholder={text.emailPlaceholder} className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] placeholder:text-[#8a958d] transition focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:cursor-not-allowed disabled:bg-[#f7f7f4] disabled:opacity-80" />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="text-sm font-semibold text-[#17201a]">{text.password}</label>
            <a href={`/glomt-losenord?lang=${locale}`} className="text-sm font-semibold text-[#17452f] hover:underline">{text.forgotPassword}</a>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={isPending} placeholder="••••••••" className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] placeholder:text-[#8a958d] transition focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:cursor-not-allowed disabled:bg-[#f7f7f4] disabled:opacity-80" />
        </div>

        {errorMessage ? <p id="login-error" className="rounded-xl bg-[#fff4f2] px-4 py-3 text-sm leading-6 text-[#8a2f1f]" role="alert">{errorMessage}</p> : <p id="login-error" className="sr-only">{text.idleError}</p>}

        <button type="submit" disabled={isPending} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#17452f] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70">
          {isPending ? text.pending : text.submit}
        </button>
      </form>

      <p id="login-help" className="mt-4 text-xs leading-6 text-[#6a756e]">{text.help}</p>
    </aside>
  );
}
