"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import authStyles from "@/components/auth/auth-marketplace.module.css";

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
    forgotPassword: "Glömt lösenordet?",
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
    forgotPassword: "Forgot your password?",
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

  const forgotPasswordHref = locale === "en" ? "/glomt-losenord?lang=en" : "/glomt-losenord";

  return (
    <aside className={authStyles.card}>
      <p className={authStyles.cardEyebrow}>{text.badge}</p>
      <h2 className={authStyles.cardTitle}>{text.title}</h2>
      <p className={authStyles.cardLead}>{text.intro}</p>

      <form className={authStyles.form} onSubmit={handleSubmit} aria-describedby="login-help login-error">
        <div className={authStyles.field}>
          <label htmlFor="email" className={authStyles.label}>{text.email}</label>
          <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={isPending} placeholder={text.emailPlaceholder} className={authStyles.input} />
        </div>

        <div className={authStyles.field}>
          <label htmlFor="password" className={authStyles.label}>{text.password}</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={isPending} placeholder="••••••••" className={authStyles.input} />
          <div className={authStyles.formMeta}>
            <Link href={forgotPasswordHref} className={authStyles.secondaryLink}>{text.forgotPassword}</Link>
          </div>
        </div>

        {errorMessage ? <p id="login-error" className={authStyles.statusError} role="alert">{errorMessage}</p> : <p id="login-error" className="sr-only">{text.idleError}</p>}

        <button type="submit" disabled={isPending} className={authStyles.primaryButton}>
          {isPending ? text.pending : text.submit}
        </button>
      </form>

      <p id="login-help" className={authStyles.helpText}>{text.help}</p>
    </aside>
  );
}
