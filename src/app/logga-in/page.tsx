import type { Metadata } from "next";
import Link from "next/link";

import { isCheckoutPlanKey } from "@/lib/billing-plans";
import { resolveSafeClaimLoginNext } from "@/lib/claim-login-return";
import { resolveOwnerPostLoginPath } from "@/lib/owner-onboarding-routing";
import {
  authLocaleHref,
  firstAuthSearchParam,
  resolveAuthLocale,
  type AuthSearchParams,
} from "@/lib/auth-locale";
import authStyles from "@/components/auth/auth-marketplace.module.css";
import { LoginForm } from "./LoginForm";

export async function generateMetadata({
  searchParams,
}: LoginPageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : undefined;
  const locale = resolveAuthLocale(params);

  return {
    title: locale === "en" ? "Sign in" : "Logga in",
    description: locale === "en"
      ? "Sign in to your Proffera business workspace."
      : "Logga in till företagets arbetsyta i Proffera.",
    robots: { index: false, follow: false },
  };
}

type LoginPageProps = {
  searchParams?: Promise<AuthSearchParams & {
    reset?: string | string[];
  }>;
};

const copy = {
  sv: {
    portal: "Företagsinloggning",
    heading: "Logga in till Proffera",
    intro: "Logga in för att fortsätta till företagets arbetsyta och hantera kunder, bokningar, leads och uppdrag.",
    highlights: [
      "Kunder, bokningar och leads samlade i samma arbetsyta.",
      "Fortsätt direkt till din arbetsyta efter inloggning.",
    ],
    signup: "Starta gratis i 14 dagar",
    demo: "Boka demo",
    created: "Kontot och arbetsytan är klara. Logga in med ditt nya lösenord.",
    reset: "Lösenordet är uppdaterat. Logga in med ditt nya lösenord.",
    languageLabel: "Språk",
  },
  en: {
    portal: "Business sign-in",
    heading: "Sign in to Proffera",
    intro: "Sign in to continue to your business workspace and manage customers, bookings, leads and jobs.",
    highlights: [
      "Customers, bookings and leads in one workspace.",
      "Continue directly to your workspace after signing in.",
    ],
    signup: "Start a free 14-day trial",
    demo: "Book a demo",
    created: "Your account and workspace are ready. Sign in with your new password.",
    reset: "Your password has been updated. Sign in with your new password.",
    languageLabel: "Language",
  },
} as const;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const rawParams = searchParams ? await searchParams : undefined;
  const createdValue = firstAuthSearchParam(rawParams?.created);
  const planValue = firstAuthSearchParam(rawParams?.plan);
  const resetValue = firstAuthSearchParam(rawParams?.reset);
  const nextValue = resolveSafeClaimLoginNext(rawParams?.next) ?? undefined;
  const params: AuthSearchParams | undefined = rawParams ? { ...rawParams } : undefined;
  if (params) {
    if (nextValue) params.next = nextValue;
    else delete params.next;
  }
  const locale = resolveAuthLocale(params);
  const text = copy[locale];
  const selectedPlan = isCheckoutPlanKey(planValue) ? planValue : null;
  const signupBaseHref = locale === "en" ? "/en/create-account" : "/skapa-konto";
  const signupHref = selectedPlan ? `${signupBaseHref}?plan=${selectedPlan}` : signupBaseHref;
  const demoHref = locale === "en" ? "/en/demo" : "/demo";
  const afterLoginPath = nextValue ?? resolveOwnerPostLoginPath({
    locale,
    accountCreated: createdValue === "1",
    selectedPlan,
  });

  return (
    <div className={authStyles.page} lang={locale === "sv" ? "sv" : "en"}>
      <section className={authStyles.shell}>
        <div className={authStyles.split}>
          <div>
            <div className={authStyles.languageRow} aria-label={text.languageLabel}>
              <span>{text.languageLabel}:</span>
              <a
                href={authLocaleHref("/logga-in", params, "sv")}
                className={`${authStyles.languageLink} ${locale === "sv" ? authStyles.languageActive : ""}`}
                aria-current={locale === "sv" ? "page" : undefined}
              >
                SV
              </a>
              <a
                href={authLocaleHref("/logga-in", params, "en")}
                className={`${authStyles.languageLink} ${locale === "en" ? authStyles.languageActive : ""}`}
                aria-current={locale === "en" ? "page" : undefined}
              >
                EN
              </a>
            </div>

            <p className={authStyles.eyebrow}>{text.portal}</p>
            <h1 className={authStyles.title}>{text.heading}</h1>
            <p className={authStyles.lead}>{text.intro}</p>

            <ul className={authStyles.trustList}>
              {text.highlights.map((item) => (
                <li key={item} className={authStyles.trustItem}>
                  <span className={authStyles.trustMark} aria-hidden="true">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className={authStyles.linkRow}>
              <Link href={signupHref} className={authStyles.textLink}>{text.signup}</Link>
              <Link href={demoHref} className={authStyles.textLink}>{text.demo}</Link>
            </div>
          </div>

          <div>
            {createdValue === "1" ? <p className={authStyles.statusSuccess} role="status">{text.created}</p> : null}
            {resetValue === "1" ? <p className={authStyles.statusSuccess} role="status">{text.reset}</p> : null}
            <div className={createdValue === "1" || resetValue === "1" ? "mt-3" : undefined}>
              <LoginForm afterLoginPath={afterLoginPath} locale={locale} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
