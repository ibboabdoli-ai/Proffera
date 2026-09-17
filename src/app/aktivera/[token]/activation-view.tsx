"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import type { AuthLocale } from "@/lib/auth-locale";
import { ActivationForm } from "./activation-form";

type ActivationViewProps = {
  action: (formData: FormData) => void | Promise<void>;
  invitation: { companyName: string; email: string } | null;
  initialLocale: AuthLocale;
  initialError?: string;
  initialRedirectQuery: string;
};

const copy = {
  sv: {
    menu: "Meny",
    language: "Språk",
    invalidTitle: "Länken kan inte användas",
    invalidText: "Den är ogiltig, har gått ut eller har redan använts.",
    contact: "Kontakta Proffera",
    portal: "Proffera kundportal",
    activate: "Aktivera kundportal för",
    benefitWorkspace: "Egen säker arbetsyta.",
    benefitOverview: "Kunder, bokningar och leads samlade.",
    benefitSingleUse: "Inbjudan kan bara användas en gång.",
    choosePassword: "Välj ditt lösenord",
    account: "Konto",
    errors: {
      password: "Lösenorden måste vara lika och innehålla minst 8 tecken.",
      expired: "Länken har gått ut. Be Proffera skicka en ny inbjudan.",
      account: "Kontot kunde inte skapas. Kontakta Proffera om e-postadressen redan används.",
      database: "Aktiveringen kunde inte slutföras just nu. Försök igen eller kontakta Proffera.",
      invalid: "Länken är ogiltig eller har redan använts.",
    },
  },
  en: {
    menu: "Menu",
    language: "Language",
    invalidTitle: "This link cannot be used",
    invalidText: "It is invalid, has expired, or has already been used.",
    contact: "Contact Proffera",
    portal: "Proffera customer portal",
    activate: "Activate customer portal for",
    benefitWorkspace: "Your own secure workspace.",
    benefitOverview: "Customers, bookings and leads in one place.",
    benefitSingleUse: "The invitation can only be used once.",
    choosePassword: "Choose your password",
    account: "Account",
    errors: {
      password: "The passwords must match and contain at least 8 characters.",
      expired: "The link has expired. Ask Proffera to send a new invitation.",
      account: "The account could not be created. Contact Proffera if the email address is already in use.",
      database: "Activation could not be completed right now. Try again or contact Proffera.",
      invalid: "The link is invalid or has already been used.",
    },
  },
} as const;

function LocaleControls({ locale, onChange }: { locale: AuthLocale; onChange: (locale: AuthLocale) => void }) {
  const text = copy[locale];
  const buttonClass = (value: AuthLocale) => [
    "min-h-10 rounded-lg px-3 text-sm font-bold",
    locale === value ? "bg-[#17452f] text-white" : "bg-white text-[#17452f] ring-1 ring-[#cfd8cf]",
  ].join(" ");

  return (
    <>
      <details className="mb-6 sm:hidden">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-[#cfd8cf] bg-white px-4 text-sm font-bold text-[#17452f] marker:hidden">
          {text.menu}
        </summary>
        <div className="mt-2 grid gap-2 rounded-2xl border border-[#dfe5dd] bg-white p-3 shadow-sm" aria-label={text.language}>
          <button type="button" className={buttonClass("sv")} onClick={() => onChange("sv")}>Svenska</button>
          <button type="button" className={buttonClass("en")} onClick={() => onChange("en")}>English</button>
        </div>
      </details>
      <div className="mb-6 hidden items-center gap-2 sm:flex" aria-label={text.language}>
        <span className="text-sm font-semibold text-[#5b665f]">{text.language}:</span>
        <button type="button" className={buttonClass("sv")} onClick={() => onChange("sv")}>SV</button>
        <button type="button" className={buttonClass("en")} onClick={() => onChange("en")}>EN</button>
      </div>
    </>
  );
}

export function applyActivationLocaleChange(
  search: string,
  pathname: string,
  nextLocale: AuthLocale,
  replaceState: (href: string) => void,
) {
  const current = new URLSearchParams(search);
  current.set("lang", nextLocale);
  const visibleQuery = current.toString();
  replaceState(`${pathname}${visibleQuery ? `?${visibleQuery}` : ""}`);

  current.delete("error");
  return current.toString();
}

export function ActivationView({ action, invitation, initialLocale, initialError, initialRedirectQuery }: ActivationViewProps) {
  const [locale, setLocale] = useState<AuthLocale>(initialLocale);
  const [redirectQuery, setRedirectQuery] = useState(initialRedirectQuery);
  const text = copy[locale];

  function changeLocale(nextLocale: AuthLocale) {
    if (nextLocale === locale) return;
    const nextRedirectQuery = applyActivationLocaleChange(
      window.location.search,
      window.location.pathname,
      nextLocale,
      (href) => window.history.replaceState(null, "", href),
    );
    setRedirectQuery(nextRedirectQuery);
    setLocale(nextLocale);
  }

  if (!invitation) {
    return (
      <main className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6" lang={locale}>
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <LocaleControls locale={locale} onChange={changeLocale} />
          <h1 className="text-3xl font-bold text-[#17201a]">{text.invalidTitle}</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">{text.invalidText}</p>
          <Link href={locale === "en" ? "/en/contact" : "/kontakt"} className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#17452f] px-5 py-3 text-sm font-bold text-white">{text.contact}</Link>
        </section>
      </main>
    );
  }

  const errorMessage = initialError
    ? text.errors[initialError as keyof typeof text.errors] ?? text.errors.invalid
    : null;

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 sm:py-16" lang={locale}>
      <div className="mx-auto max-w-4xl">
        <LocaleControls locale={locale} onChange={changeLocale} />
        <div className="grid overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-[#dfe5dd] lg:grid-cols-[0.85fr_1.15fr]">
          <section className="bg-[#102a1c] p-7 text-white sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">{text.portal}</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-[-0.04em]">{text.activate} {invitation.companyName}</h1>
            <ul className="mt-8 space-y-4 text-sm leading-6 text-white/85">
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#a9dbb9]" aria-hidden="true" />{text.benefitWorkspace}</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#a9dbb9]" aria-hidden="true" />{text.benefitOverview}</li>
              <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#a9dbb9]" aria-hidden="true" />{text.benefitSingleUse}</li>
            </ul>
          </section>
          <section className="p-6 sm:p-10">
            <h2 className="text-2xl font-bold text-[#17201a]">{text.choosePassword}</h2>
            <p className="mt-3 text-sm leading-6 text-[#5b665f]">{text.account}: <strong className="text-[#17201a]">{invitation.email}</strong></p>
            {errorMessage ? <p className="mt-5 rounded-xl border border-[#e7b8b1] bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#8a2b20]" role="alert">{errorMessage}</p> : null}
            <ActivationForm action={action} locale={locale} redirectQuery={redirectQuery} />
          </section>
        </div>
      </div>
    </main>
  );
}
