"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import authStyles from "@/components/auth/auth-marketplace.module.css";
import { authClient } from "@/lib/auth-client";

type PasswordResetLocale = "sv" | "en";

const copy = {
  sv: {
    email: "E-post",
    emailPlaceholder: "namn@foretag.se",
    submit: "Skicka återställningslänk",
    pending: "Skickar...",
    success: "Om det finns ett konto med den e-postadressen skickar vi en återställningslänk. Kontrollera även skräpposten.",
    error: "Det gick inte att behandla begäran just nu. Försök igen om en stund.",
    back: "Tillbaka till inloggning",
  },
  en: {
    email: "Email",
    emailPlaceholder: "name@company.com",
    submit: "Send reset link",
    pending: "Sending...",
    success: "If an account exists for that email address, we will send a reset link. Please also check your spam folder.",
    error: "We could not process the request right now. Please try again shortly.",
    back: "Back to sign in",
  },
} as const;

export function PasswordResetRequestForm({ locale }: { locale: PasswordResetLocale }) {
  const text = copy[locale];
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    setErrorMessage(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const redirectTo = locale === "en"
        ? "/aterstall-losenord?lang=en"
        : "/aterstall-losenord";
      const { error } = await authClient.requestPasswordReset({
        email: normalizedEmail,
        redirectTo,
      });
      if (error) {
        setErrorMessage(text.error);
        setIsPending(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setErrorMessage(text.error);
    } finally {
      setIsPending(false);
    }
  }

  if (submitted) {
    return (
      <div className="grid gap-4" role="status">
        <p className={authStyles.statusSuccess}>
          {text.success}
        </p>
        <Link href={locale === "en" ? "/logga-in?lang=en" : "/logga-in"} className={authStyles.secondaryLink}>
          {text.back}
        </Link>
      </div>
    );
  }

  return (
    <form className={authStyles.form} onSubmit={handleSubmit}>
      <div>
        <label htmlFor="reset-email" className={authStyles.label}>{text.email}</label>
        <input
          id="reset-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isPending}
          placeholder={text.emailPlaceholder}
          className={authStyles.input}
        />
      </div>
      {errorMessage ? <p className={authStyles.statusError} role="alert">{errorMessage}</p> : null}
      <button type="submit" disabled={isPending} className={authStyles.primaryButton}>
        {isPending ? text.pending : text.submit}
      </button>
      <Link href={locale === "en" ? "/logga-in?lang=en" : "/logga-in"} className={authStyles.secondaryLink}>
        {text.back}
      </Link>
    </form>
  );
}
