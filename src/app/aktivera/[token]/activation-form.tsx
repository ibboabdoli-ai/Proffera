"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";

import type { AuthLocale } from "@/lib/auth-locale";

type ActivationFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  locale: AuthLocale;
  redirectQuery: string;
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
    <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#17452f] px-5 py-3 text-base font-bold text-white transition hover:bg-[#123724] focus:outline-none focus:ring-4 focus:ring-[#17452f]/20 disabled:cursor-wait disabled:opacity-70">
      {pending ? text.pending : text.submit}
    </button>
  );
}

export function ActivationForm({ action, locale, redirectQuery }: ActivationFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const text = copy[locale];
  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-[#cfd8cf] bg-white px-4 py-3 pr-12 text-base text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-4 focus:ring-[#17452f]/10";

  return (
    <form action={action} className="mt-7 grid gap-5">
      <input type="hidden" name="lang" value={locale} />
      <input type="hidden" name="redirect_query" value={redirectQuery} />
      <label className="text-sm font-semibold text-[#26322a]">
        {text.password}
        <span className="relative block">
          <input className={inputClass} name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-2 right-1 mt-2 flex w-11 items-center justify-center rounded-lg text-[#5b665f] hover:bg-[#eef5ef] focus:outline-none focus:ring-2 focus:ring-[#17452f]" aria-label={showPassword ? text.hidePassword : text.showPassword}>
            {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
        </span>
      </label>
      <label className="text-sm font-semibold text-[#26322a]">
        {text.confirmPassword}
        <input className={inputClass} name="confirm_password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required />
      </label>
      <p className="text-xs leading-5 text-[#6b766e]">{text.hint}</p>
      <SubmitButton locale={locale} />
    </form>
  );
}
