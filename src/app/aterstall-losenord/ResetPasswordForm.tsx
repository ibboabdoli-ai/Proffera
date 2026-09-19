"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import authStyles from "@/components/auth/auth-marketplace.module.css";
import { authClient } from "@/lib/auth-client";

type PasswordResetLocale = "sv" | "en";

const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export function readResetToken(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const candidate = params.get("token")?.trim() ?? "";
  return RESET_TOKEN_PATTERN.test(candidate) ? candidate : null;
}

export function resetUrlWithoutFragment(pathname: string, search: string) {
  return `${pathname}${search}`;
}

export function resetCompletionLoginUrl(locale: PasswordResetLocale) {
  return locale === "en" ? "/logga-in?lang=en&reset=1" : "/logga-in?reset=1";
}

export function resetLocaleTarget(locale: PasswordResetLocale, token: string | null) {
  const target = locale === "en" ? "/aterstall-losenord?lang=en" : "/aterstall-losenord";
  if (!token) return target;
  const fragment = new URLSearchParams({ token }).toString();
  return `${target}#${fragment}`;
}

export async function submitResetPassword(input: {
  token: string | null;
  password: string;
  confirmation: string;
  resetPassword: (input: { newPassword: string; token: string }) => Promise<{ error?: unknown }>;
}) {
  if (!input.token) return { ok: false, error: "invalidToken" as const };
  if (input.password.length < 8 || input.password.length > 128) {
    return { ok: false, error: "invalidPassword" as const };
  }
  if (input.password !== input.confirmation) {
    return { ok: false, error: "mismatch" as const };
  }
  const result = await input.resetPassword({
    newPassword: input.password,
    token: input.token,
  });
  return result.error
    ? { ok: false, error: "reset" as const }
    : { ok: true, error: null };
}

const copy = {
  sv: {
    language: "Språk",
    password: "Nytt lösenord",
    confirm: "Bekräfta nytt lösenord",
    hint: "Minst 8 tecken.",
    submit: "Spara nytt lösenord",
    pending: "Sparar...",
    mismatch: "Lösenorden matchar inte.",
    invalidPassword: "Lösenordet måste vara mellan 8 och 128 tecken.",
    invalidToken: "Återställningslänken är ogiltig eller har gått ut. Begär en ny länk.",
    error: "Lösenordet kunde inte återställas. Länken kan vara förbrukad eller ha gått ut.",
    requestAgain: "Begär en ny återställningslänk",
  },
  en: {
    language: "Language",
    password: "New password",
    confirm: "Confirm new password",
    hint: "At least 8 characters.",
    submit: "Save new password",
    pending: "Saving...",
    mismatch: "The passwords do not match.",
    invalidPassword: "The password must be between 8 and 128 characters.",
    invalidToken: "The reset link is invalid or has expired. Request a new link.",
    error: "The password could not be reset. The link may have been used or expired.",
    requestAgain: "Request a new reset link",
  },
} as const;

function initialResetToken() {
  if (typeof window === "undefined") return null;
  return readResetToken(window.location.hash);
}

export function ResetPasswordForm({ locale }: { locale: PasswordResetLocale }) {
  const text = copy[locale];
  const [token] = useState<string | null>(initialResetToken);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        "",
        resetUrlWithoutFragment(window.location.pathname, window.location.search),
      );
    }
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function switchLocale(nextLocale: PasswordResetLocale) {
    if (nextLocale === locale) return;
    window.location.replace(resetLocaleTarget(nextLocale, token));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    setErrorMessage(null);
    try {
      const result = await submitResetPassword({
        token,
        password,
        confirmation,
        resetPassword: (input) => authClient.resetPassword(input),
      });
      if (!result.ok) {
        if (result.error === "invalidPassword") setErrorMessage(text.invalidPassword);
        else if (result.error === "mismatch") setErrorMessage(text.mismatch);
        else if (result.error === "invalidToken") setErrorMessage(text.invalidToken);
        else setErrorMessage(text.error);
        return;
      }
      window.location.replace(resetCompletionLoginUrl(locale));
    } catch {
      setErrorMessage(text.error);
    } finally {
      setIsPending(false);
    }
  }

  const requestAgainUrl = locale === "en" ? "/glomt-losenord?lang=en" : "/glomt-losenord";
  const languageSwitcher = (
    <div className={authStyles.languageRow} aria-label={text.language}>
      <span className={authStyles.label}>{text.language}:</span>
      <button
        type="button"
        aria-pressed={locale === "sv"}
        onClick={() => switchLocale("sv")}
        className={`${authStyles.languageButton} ${locale === "sv" ? authStyles.languageActive : ""}`}
      >
        SV
      </button>
      <button
        type="button"
        aria-pressed={locale === "en"}
        onClick={() => switchLocale("en")}
        className={`${authStyles.languageButton} ${locale === "en" ? authStyles.languageActive : ""}`}
      >
        EN
      </button>
    </div>
  );

  if (!ready) {
    return (
      <div>
        {languageSwitcher}
        <div className={authStyles.skeleton} aria-hidden="true" />
      </div>
    );
  }

  if (!token) {
    return (
      <div>
        {languageSwitcher}
        <div className="grid gap-5">
          <p className={authStyles.statusError} role="alert">{text.invalidToken}</p>
          <Link href={requestAgainUrl} className={authStyles.secondaryLink}>{text.requestAgain}</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {languageSwitcher}
      <form className={authStyles.form} onSubmit={handleSubmit}>
        <div>
          <label htmlFor="new-password" className={authStyles.label}>{text.password}</label>
          <input
            id="new-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isPending}
            className={authStyles.input}
          />
          <p className={authStyles.helpText}>{text.hint}</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className={authStyles.label}>{text.confirm}</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={isPending}
            className={authStyles.input}
          />
        </div>
        {errorMessage ? <p className={authStyles.statusError} role="alert">{errorMessage}</p> : null}
        <button type="submit" disabled={isPending} className={authStyles.primaryButton}>
          {isPending ? text.pending : text.submit}
        </button>
      </form>
    </div>
  );
}
