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

export const metadata: Metadata = {
  title: "Sign in | Proffera",
  description: "Sign in to the Proffera customer portal.",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams?: Promise<AuthSearchParams & {
    reset?: string | string[];
  }>;
};

const copy = {
  sv: {
    portal: "Proffera kundportal",
    heading: "Logga in till Proffera",
    intro: "Logga in med ditt Proffera-konto för att komma åt dashboard, kunder, leads och bokningar.",
    pilotTitle: "För pilotkunder",
    pilotText: "Åtkomst öppnas när konto, workspace och behörigheter är aktiva.",
    helpTitle: "Behöver du hjälp?",
    helpText: "Kontakta Proffera för demo, onboarding eller planerad åtkomst.",
    demo: "Boka demo",
    contact: "Kontakta Proffera",
    created: "Kontot och kundportalen är klara. Logga in med ditt nya lösenord.",
    reset: "Lösenordet är uppdaterat. Logga in med ditt nya lösenord.",
    languageLabel: "Språk",
  },
  en: {
    portal: "Proffera customer portal",
    heading: "Sign in to Proffera",
    intro: "Sign in with your Proffera account to access your dashboard, customers, leads and bookings.",
    pilotTitle: "For pilot customers",
    pilotText: "Access becomes available when your account, workspace and permissions are active.",
    helpTitle: "Need help?",
    helpText: "Contact Proffera for a demo, onboarding or planned access.",
    demo: "Book a demo",
    contact: "Contact Proffera",
    created: "Your account and customer portal are ready. Sign in with your new password.",
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
  const afterLoginPath = nextValue ?? resolveOwnerPostLoginPath({
    locale,
    accountCreated: createdValue === "1",
    selectedPlan,
  });

  return (
    <main className={authStyles.page} lang={locale === "sv" ? "sv" : "en"}>
      <section className={authStyles.shell}>
        <div className={authStyles.split}>
          <div>
            <div className={authStyles.languageRow} aria-label={text.languageLabel}>
              <span>{text.languageLabel}:</span>
              <Link
                href={authLocaleHref("/logga-in", params, "sv")}
                className={`${authStyles.languageLink} ${locale === "sv" ? authStyles.languageActive : ""}`}
              >
                SV
              </Link>
              <Link
                href={authLocaleHref("/logga-in", params, "en")}
                className={`${authStyles.languageLink} ${locale === "en" ? authStyles.languageActive : ""}`}
              >
                EN
              </Link>
            </div>

            <p className={authStyles.eyebrow}>{text.portal}</p>
            <h1 className={authStyles.title}>{text.heading}</h1>
            <p className={authStyles.lead}>{text.intro}</p>

            <div className={authStyles.infoGrid}>
              <div className={authStyles.infoCell}>
                <strong>{text.pilotTitle}</strong>
                <p>{text.pilotText}</p>
              </div>
              <div className={authStyles.infoCell}>
                <strong>{text.helpTitle}</strong>
                <p>{text.helpText}</p>
              </div>
            </div>

            <div className={authStyles.linkRow}>
              <Link href="/demo" className={authStyles.textLink}>{text.demo}</Link>
              <Link href="/kontakt" className={authStyles.textLink}>{text.contact}</Link>
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
    </main>
  );
}
