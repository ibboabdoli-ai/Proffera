"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";

type ActivationFormProps = {
  action: (formData: FormData) => void | Promise<void>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#17452f] px-5 py-3 text-base font-bold text-white transition hover:bg-[#123724] focus:outline-none focus:ring-4 focus:ring-[#17452f]/20 disabled:cursor-wait disabled:opacity-70">
      {pending ? "Aktiverar..." : "Aktivera kundportalen"}
    </button>
  );
}

export function ActivationForm({ action }: ActivationFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const inputClass = "mt-2 min-h-12 w-full rounded-xl border border-[#cfd8cf] bg-white px-4 py-3 pr-12 text-base text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-4 focus:ring-[#17452f]/10";

  return (
    <form action={action} className="mt-7 grid gap-5">
      <label className="text-sm font-semibold text-[#26322a]">
        Välj lösenord
        <span className="relative block">
          <input className={inputClass} name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required />
          <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-2 right-1 mt-2 flex w-11 items-center justify-center rounded-lg text-[#5b665f] hover:bg-[#eef5ef] focus:outline-none focus:ring-2 focus:ring-[#17452f]" aria-label={showPassword ? "Dölj lösenord" : "Visa lösenord"}>
            {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
        </span>
      </label>
      <label className="text-sm font-semibold text-[#26322a]">
        Upprepa lösenord
        <input className={inputClass} name="confirm_password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required />
      </label>
      <p className="text-xs leading-5 text-[#6b766e]">Minst 8 tecken. Använd ett lösenord som du inte använder på andra webbplatser.</p>
      <SubmitButton />
    </form>
  );
}
