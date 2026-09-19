"use client";

import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useState } from "react";

import authStyles from "@/components/auth/auth-marketplace.module.css";
import type { AuthLocale } from "@/lib/auth-locale";
import { PUBLIC_LOCALE_CHANGE_EVENT } from "@/lib/public-locale";
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
    language: "Språk",
    invalidTitle: "Länken kan inte användas",
    invalidText: "Den är ogiltig, har gått ut eller har redan använts.",
    contact: "Kontakta Proffera",
    portal: "Proffera arbetsyta",
    activate: "Aktivera arbetsyta för",
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
    language: "Language",
    invalidTitle: "This link cannot be used",
    invalidText: "It is invalid, has expired, or has already been used.",
    contact: "Contact Proffera",
    portal: "Proffera workspace",
    activate: "Activate workspace for",
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

  return (
    <div className={authStyles.languageRow} aria-label={text.language}>
      <span>{text.language}:</span>
      <button
        type="button"
        aria-pressed={locale === "sv"}
        className={`${authStyles.languageButton} ${locale === "sv" ? authStyles.languageActive : ""}`}
        onClick={() => onChange("sv")}
      >
        SV
      </button>
      <button
        type="button"
        aria-pressed={locale === "en"}
        className={`${authStyles.languageButton} ${locale === "en" ? authStyles.languageActive : ""}`}
        onClick={() => onChange("en")}
      >
        EN
      </button>
    </div>
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
  current.delete("error");
  const visibleQuery = current.toString();
  replaceState(`${pathname}${visibleQuery ? `?${visibleQuery}` : ""}`);

  return current.toString();
}

export function ActivationView({
  action,
  invitation,
  initialLocale,
  initialError,
  initialRedirectQuery,
}: ActivationViewProps) {
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
    window.dispatchEvent(new CustomEvent(PUBLIC_LOCALE_CHANGE_EVENT, { detail: nextLocale }));
  }

  if (!invitation) {
    return (
      <div className={authStyles.page} lang={locale}>
        <section className={authStyles.shell}>
          <div className={authStyles.single}>
            <LocaleControls locale={locale} onChange={changeLocale} />
            <section className={authStyles.card}>
              <p className={authStyles.cardEyebrow}>{text.portal}</p>
              <h1 className={authStyles.cardTitle}>{text.invalidTitle}</h1>
              <p className={authStyles.cardLead}>{text.invalidText}</p>
              <div className={authStyles.linkRow}>
                <Link href={locale === "en" ? "/en/contact" : "/kontakt"} className={authStyles.textLink}>
                  {text.contact}
                </Link>
              </div>
            </section>
          </div>
        </section>
      </div>
    );
  }

  const errorMessage = initialError
    ? text.errors[initialError as keyof typeof text.errors] ?? text.errors.invalid
    : null;

  return (
    <div className={authStyles.page} lang={locale}>
      <section className={authStyles.shell}>
        <LocaleControls locale={locale} onChange={changeLocale} />

        <div className={authStyles.split}>
          <div>
            <p className={authStyles.eyebrow}>{text.portal}</p>
            <h1 className={authStyles.title}>{text.activate} {invitation.companyName}</h1>
            <p className={authStyles.lead}>
              {text.account}: <strong>{invitation.email}</strong>
            </p>

            <ul className={authStyles.trustList}>
              <li className={authStyles.trustItem}>
                <span className={authStyles.trustMark}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <span>{text.benefitWorkspace}</span>
              </li>
              <li className={authStyles.trustItem}>
                <span className={authStyles.trustMark}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <span>{text.benefitOverview}</span>
              </li>
              <li className={authStyles.trustItem}>
                <span className={authStyles.trustMark}><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <span>{text.benefitSingleUse}</span>
              </li>
            </ul>
          </div>

          <section className={authStyles.card}>
            <p className={authStyles.cardEyebrow}>{text.portal}</p>
            <h2 className={authStyles.cardTitle}>{text.choosePassword}</h2>
            <p className={authStyles.cardLead}>{text.account}: <strong>{invitation.email}</strong></p>
            {errorMessage ? <p className={`${authStyles.statusError} mt-4`} role="alert">{errorMessage}</p> : null}
            <ActivationForm action={action} locale={locale} redirectQuery={redirectQuery} />
          </section>
        </div>
      </section>
    </div>
  );
}
