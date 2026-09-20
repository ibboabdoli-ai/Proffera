"use client";

import { type FormEvent, useState } from "react";

import authStyles from "@/components/auth/auth-marketplace.module.css";
import { authClient } from "@/lib/auth-client";
import { getCheckoutPlanPriceLabel, type CheckoutPlanKey } from "@/lib/billing-plans";

export type SignupLocale = "sv" | "en";

type SignupFormProps = {
  locale: SignupLocale;
  initialPlan: CheckoutPlanKey;
  sessionUser?: {
    name: string;
    email: string;
  } | null;
};

const copy = {
  sv: {
    title: "Skapa ditt Proffera-konto",
    intro: "Starta 14 dagar gratis. Ingen betalning krävs för att komma igång.",
    contactName: "Ditt namn",
    companyName: "Företagsnamn",
    email: "E-post",
    password: "Lösenord",
    city: "Ort",
    phone: "Telefon",
    plan: "Plan efter provperioden",
    starter: `Starter – från ${getCheckoutPlanPriceLabel("starter", "SEK", "sv")}`,
    professional: `Professional – från ${getCheckoutPlanPriceLabel("professional", "SEK", "sv")}`,
    submit: "Starta 14 dagar gratis",
    pending: "Skapar konto och arbetsyta...",
    genericError: "Det gick inte att slutföra registreringen. Försök igen.",
    existingEmail: "E-postadressen används redan. Logga in och fortsätt därifrån.",
    recovery: "Kontot skapades, men arbetsytan blev inte klar. Försök igen så fortsätter vi utan att skapa ett nytt konto.",
    login: "Har du redan ett konto? Logga in",
    terms: "Genom att fortsätta godkänner du Profferas villkor och integritetspolicy.",
  },
  en: {
    title: "Create your Proffera account",
    intro: "Start with a 14-day free trial. No payment is required to get started.",
    contactName: "Your name",
    companyName: "Company name",
    email: "Email",
    password: "Password",
    city: "City",
    phone: "Phone",
    plan: "Plan after the trial",
    starter: `Starter – from ${getCheckoutPlanPriceLabel("starter", "SEK", "en")}`,
    professional: `Professional – from ${getCheckoutPlanPriceLabel("professional", "SEK", "en")}`,
    submit: "Start 14-day free trial",
    pending: "Creating account and workspace...",
    genericError: "We could not complete the registration. Please try again.",
    existingEmail: "This email is already in use. Sign in and continue from there.",
    recovery: "Your account was created, but the workspace was not completed. Try again and we will continue without creating another account.",
    login: "Already have an account? Sign in",
    terms: "By continuing, you agree to Proffera's terms and privacy policy.",
  },
} as const;

type SignupSubmissionError = "existingEmail" | "genericError" | "recovery";

type SignupSubmissionInput = {
  locale: SignupLocale;
  accountReady: boolean;
  contactName: string;
  companyName: string;
  email: string;
  password: string;
  city: string;
  phone: string;
  plan: CheckoutPlanKey;
};

type SignupSubmissionDependencies = {
  signUpEmail: (input: { name: string; email: string; password: string }) => Promise<{ error?: { status?: number } | null }>;
  provision: (input: {
    companyName: string;
    city: string;
    phone: string;
    plan: CheckoutPlanKey;
  }) => Promise<{ ok: boolean; redirectPath?: string }>;
  persistLocale: (locale: SignupLocale) => void;
  navigate: (href: string) => void;
};

export async function submitSignup(
  input: SignupSubmissionInput,
  dependencies: SignupSubmissionDependencies,
): Promise<{ accountReady: boolean; error: SignupSubmissionError | null }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  let accountReady = input.accountReady;

  if (!accountReady) {
    const { error } = await dependencies.signUpEmail({
      name: input.contactName.trim(),
      email: normalizedEmail,
      password: input.password,
    });

    if (error) {
      return {
        accountReady: false,
        error: error.status === 422 || error.status === 409 ? "existingEmail" : "genericError",
      };
    }

    accountReady = true;
  }

  let result: { ok: boolean; redirectPath?: string };
  try {
    result = await dependencies.provision({
      companyName: input.companyName.trim(),
      city: input.city.trim(),
      phone: input.phone.trim(),
      plan: input.plan,
    });
  } catch {
    return { accountReady, error: accountReady ? "recovery" : "genericError" };
  }

  if (!result.ok) {
    return { accountReady, error: accountReady ? "recovery" : "genericError" };
  }

  try {
    dependencies.persistLocale(input.locale);
  } catch {
    // Locale persistence is best-effort after the account and workspace already exist.
  }

  try {
    dependencies.navigate(result.redirectPath || "/dashboard/onboarding?new=1");
  } catch {
    return { accountReady, error: "recovery" };
  }

  return { accountReady, error: null };
}

export function SignupForm({ locale, initialPlan, sessionUser }: SignupFormProps) {
  const text = copy[locale];
  const [contactName, setContactName] = useState(sessionUser?.name ?? "");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState(sessionUser?.email ?? "");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<CheckoutPlanKey>(initialPlan);
  const [accountReady, setAccountReady] = useState(Boolean(sessionUser));
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    setErrorMessage(null);

    try {
      const result = await submitSignup({
        locale,
        accountReady,
        contactName,
        companyName,
        email,
        password,
        city,
        phone,
        plan,
      }, {
        signUpEmail: (input) => authClient.signUp.email(input),
        provision: async (input) => {
          const response = await fetch("/api/signup/provision", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify(input),
          });
          const body = (await response.json().catch(() => null)) as {
            ok?: boolean;
            redirectPath?: string;
          } | null;
          return { ok: response.ok && body?.ok === true, redirectPath: body?.redirectPath };
        },
        persistLocale: (nextLocale) => {
          window.localStorage.setItem("proffera-locale", nextLocale);
          document.cookie = `proffera_locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
        },
        navigate: (href) => window.location.assign(href),
      });

      if (result.accountReady && !accountReady) setAccountReady(true);
      if (result.error) setErrorMessage(text[result.error]);
    } catch {
      setErrorMessage(accountReady ? text.recovery : text.genericError);
    } finally {
      setIsPending(false);
    }
  }

  const safeLocale: SignupLocale = locale === "en" ? "en" : "sv";
  const safePlan: CheckoutPlanKey = plan === "professional" ? "professional" : "starter";
  const loginHref = `/logga-in?lang=${safeLocale}&plan=${safePlan}`;

  return (
    <aside className={authStyles.card}>
      <p className={authStyles.cardEyebrow}>{locale === "en" ? "Business account" : "Företagskonto"}</p>
      <h2 className={authStyles.cardTitle}>{text.title}</h2>
      <p className={authStyles.cardLead}>{text.intro}</p>

      <form className={authStyles.form} onSubmit={handleSubmit}>
        {!accountReady ? (
          <div className={authStyles.field}>
            <label htmlFor="signup-name" className={authStyles.label}>{text.contactName}</label>
            <input id="signup-name" autoComplete="name" required minLength={2} maxLength={120} value={contactName} onChange={(event) => setContactName(event.target.value)} disabled={isPending} className={authStyles.input} />
          </div>
        ) : null}

        <div className={authStyles.field}>
          <label htmlFor="signup-company" className={authStyles.label}>{text.companyName}</label>
          <input id="signup-company" autoComplete="organization" required minLength={2} maxLength={160} value={companyName} onChange={(event) => setCompanyName(event.target.value)} disabled={isPending} className={authStyles.input} />
        </div>

        <div className={authStyles.field}>
          <label htmlFor="signup-email" className={authStyles.label}>{text.email}</label>
          <input id="signup-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={isPending || accountReady} className={authStyles.input} />
        </div>

        {!accountReady ? (
          <div className={authStyles.field}>
            <label htmlFor="signup-password" className={authStyles.label}>{text.password}</label>
            <input id="signup-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} disabled={isPending} className={authStyles.input} />
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className={authStyles.field}>
            <label htmlFor="signup-city" className={authStyles.label}>{text.city}</label>
            <input id="signup-city" autoComplete="address-level2" required maxLength={160} value={city} onChange={(event) => setCity(event.target.value)} disabled={isPending} className={authStyles.input} />
          </div>
          <div className={authStyles.field}>
            <label htmlFor="signup-phone" className={authStyles.label}>{text.phone}</label>
            <input id="signup-phone" type="tel" autoComplete="tel" maxLength={80} value={phone} onChange={(event) => setPhone(event.target.value)} disabled={isPending} className={authStyles.input} />
          </div>
        </div>

        <div className={authStyles.field}>
          <label htmlFor="signup-plan" className={authStyles.label}>{text.plan}</label>
          <select id="signup-plan" value={plan} onChange={(event) => setPlan(event.target.value as CheckoutPlanKey)} disabled={isPending} className={authStyles.select}>
            <option value="starter">{text.starter}</option>
            <option value="professional">{text.professional}</option>
          </select>
        </div>

        {errorMessage ? <p className={authStyles.statusError} role="alert">{errorMessage}</p> : null}

        <button type="submit" disabled={isPending} className={authStyles.primaryButton}>
          {isPending ? text.pending : text.submit}
        </button>
      </form>

      <p className={authStyles.terms}>{text.terms}</p>
      <a href={loginHref} className={authStyles.secondaryLink}>{text.login}</a>
    </aside>
  );
}
