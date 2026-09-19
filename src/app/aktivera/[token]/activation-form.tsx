"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";

import authStyles from "@/components/auth/auth-marketplace.module.css";
import type { AuthLocale } from "@/lib/auth-locale";

type ActivationFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  locale?: AuthLocale;
  redirectQuery?: string;
};

const copy = {
  sv: {
    password: "Välj lösenord",
    confirmPassword: "Upprepa lösenord",
    showPassword: "Visa lösenord",
    hidePassword: "Dölj lösenord",
    hint: "Minst 8 tecken. Använd ett lösenord som du inte använder på andra webbplatser.",
    submit: "Aktivera kundportalen",
    pending: "Aktiverar...",
  },
  en: {
    password: "Choose password",
    confirmPassword: "Repeat password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    hint: "At least 8 characters. Use a password you do not use on other websites.",
    submit: "Activate customer portal",
    pending: "Activating...",
  },
} as const;

function SubmitButton({ locale }: { locale: AuthLocale }) {
  const { pending } = useFormStatus();
  const text = copy[locale];

  return (
    <button type="submit" disabled={pending} className={authStyles.primaryButton}>
      {pending ? text.pending : text.submit}
    </button>
  );
}

export function ActivationForm({ action, locale = "sv", redirectQuery = "" }: ActivationFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const text = copy[locale];
  const passwordInputClass = `${authStyles.input} ${authStyles.passwordInput}`;

  return (
    <form action={action} className={authStyles.form}>
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="redirect_query" value={redirectQuery} />
      <label className={authStyles.label}>
        {text.password}
        <span className="relative block">
          <input className={passwordInputClass} name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-md text-[#617085] hover:bg-[#eef5ff] focus:outline-none focus:ring-2 focus:ring-[#1469d8]" aria-label={showPassword ? text.hidePassword : text.showPassword}>
            {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
        </span>
      </label>
      <label className={authStyles.label}>
        {text.confirmPassword}
        <input className={authStyles.input} name="confirm_password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required />
      </label>
      <p className={authStyles.helpText}>{text.hint}</p>
      <SubmitButton locale={locale} />
    </form>
  );
}
