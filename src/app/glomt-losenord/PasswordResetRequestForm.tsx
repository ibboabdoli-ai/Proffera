"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

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
      <div className="grid gap-5" role="status">
        <p className="rounded-xl border border-[#b8d9c2] bg-[#eef8f0] px-4 py-4 text-sm leading-6 text-[#17452f]">
          {text.success}
        </p>
        <Link href={locale === "en" ? "/logga-in?lang=en" : "/logga-in"} className="text-sm font-semibold text-[#17452f] underline underline-offset-4">
          {text.back}
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="reset-email" className="text-sm font-semibold text-[#17201a]">{text.email}</label>
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
          className="mt-2 w-full rounded-xl border border-[#d7ded5] bg-white px-4 py-3 text-base text-[#17201a] placeholder:text-[#8a958d] focus:border-[#17452f] focus:outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:opacity-70"
        />
      </div>
      {errorMessage ? <p className="rounded-xl bg-[#fff4f2] px-4 py-3 text-sm leading-6 text-[#8a2f1f]" role="alert">{errorMessage}</p> : null}
      <button type="submit" disabled={isPending} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#17452f] px-6 py-3 text-base font-semibold text-white hover:bg-[#123824] disabled:cursor-not-allowed disabled:opacity-70">
        {isPending ? text.pending : text.submit}
      </button>
      <Link href={locale === "en" ? "/logga-in?lang=en" : "/logga-in"} className="text-center text-sm font-semibold text-[#17452f] underline underline-offset-4">
        {text.back}
      </Link>
    </form>
  );
}
