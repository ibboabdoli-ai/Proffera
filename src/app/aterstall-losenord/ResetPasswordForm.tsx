"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

type PasswordResetLocale = "sv" | "en";

const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

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
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const candidate = params.get("token")?.trim() ?? "";
  return RESET_TOKEN_PATTERN.test(candidate) ? candidate : null;
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
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    const timer = window.setTimeout(() => setReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function switchLocale(nextLocale: PasswordResetLocale) {
    if (nextLocale === locale) return;
    const target = nextLocale === "en" ? "/aterstall-losenord?lang=en" : "/aterstall-losenord";
    if (!token) {
      window.location.replace(target);
      return;
    }
    const fragment = new URLSearchParams({ token }).toString();
    window.location.replace(`${target}#${fragment}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || isPending) return;
    if (password.length < 8 || password.length > 128) {
      setErrorMessage(text.invalidPassword);
      return;
    }
    if (password !== confirmation) {
      setErrorMessage(text.mismatch);
      return;
    }

    setIsPending(true);
    setErrorMessage(null);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (error) {
        setErrorMessage(text.error);
        setIsPending(false);
        return;
      }
      const loginUrl = locale === "en" ? "/logga-in?lang=en&reset=1" : "/logga-in?reset=1";
      window.location.replace(loginUrl);
    } catch {
      setErrorMessage(text.error);
      setIsPending(false);
    }
  }

  const requestAgainUrl = locale === "en" ? "/glomt-losenord?lang=en" : "/glomt-losenord";
  const languageSwitcher = (
    <div className="mb-6 flex items-center gap-3 text-sm" aria-label={text.language}>
      <span className="font-semibold text-[#5b665f]">{text.language}:</span>
      <button
        type="button"
        aria-pressed={locale === "sv"}
        onClick={() => switchLocale("sv")}
        className={`rounded-full px-3 py-1.5 font-semibold ${locale === "sv" ? "bg-[#17452f] text-white" : "bg-white text-[#17452f] ring-1 ring-[#d7ded5]"}`}
      >
        SV
      </button>
      <button
        type="button"
        aria-pressed={locale === "en"}
        onClick={() => switchLocale("en")}
        className={`rounded-full px-3 py-1.5 font-semibold ${locale === "en" ? "bg-[#17452f] text-white" : "bg-white text-[#17452f] ring-1 ring-[#d7ded5]"}`}
      >
        EN
      </button>
    </div>
  );

  if (!ready) {
    return (
      <div>
        {languageSwitcher}
        <div className="h-32 animate-pulse rounded-xl bg-[#f2f5f2]" aria-hidden="true" />
      </div>
    );
  }

  if (!token) {
    return (
      <div>
        {languageSwitcher}
        <div className="grid gap-5">
          <p className="rounded-xl bg-[#fff4f2] px-4 py-4 text-sm leading-6 text-[#8a2f1f]" role="alert">{text.invalidToken}</p>
          <Link href={requestAgainUrl} className="text-sm font-semibold text-[#17452f] underline underline-offset-4">{text.requestAgain}</Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      {languageSwitcher}
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="new-password" className="text-sm font-semibold text-[#17201a]">{text.password}</label>
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
            className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:opacity-70"
          />
          <p className="mt-2 text-xs text-[#68736b]">{text.hint}</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className="text-sm font-semibold text-[#17201a]">{text.confirm}</label>
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
            className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:opacity-70"
          />
        </div>
        {errorMessage ? <p className="rounded-xl bg-[#fff4f2] px-4 py-3 text-sm leading-6 text-[#8a2f1f]" role="alert">{errorMessage}</p> : null}
        <button type="submit" disabled={isPending} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#17452f] px-6 py-3 text-base font-semibold text-white hover:bg-[#123824] disabled:cursor-not-allowed disabled:opacity-70">
          {isPending ? text.pending : text.submit}
        </button>
      </form>
    </div>
  );
}
