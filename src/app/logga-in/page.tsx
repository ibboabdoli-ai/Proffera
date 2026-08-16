import type { Metadata } from "next";
import Link from "next/link";

import { isCheckoutPlanKey } from "@/lib/billing-plans";
import { resolveOwnerPostLoginPath } from "@/lib/owner-onboarding-routing";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in | Proffera",
  description: "Sign in to the Proffera customer portal.",
  robots: { index: false, follow: false },
};

type LoginLocale = "sv" | "en";

type LoginPageProps = {
  searchParams?: Promise<{
    created?: string | string[];
    plan?: string | string[];
    lang?: string | string[];
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
    languageLabel: "Language",
  },
} as const;

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function languageHref(locale: LoginLocale, createdValue?: string, planValue?: string) {
  const params = new URLSearchParams({ lang: locale });
  if (createdValue) params.set("created", createdValue);
  if (planValue) params.set("plan", planValue);
  return `/logga-in?${params.toString()}`;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const createdValue = first(params?.created);
  const planValue = first(params?.plan);
  const locale: LoginLocale = first(params?.lang) === "en" ? "en" : "sv";
  const text = copy[locale];
  const selectedPlan = isCheckoutPlanKey(planValue) ? planValue : null;
  const afterLoginPath = resolveOwnerPostLoginPath({
    locale,
    accountCreated: createdValue === "1",
    selectedPlan,
  });

  return (
    <main className="relative overflow-hidden bg-[#f7f7f4]" lang={locale === "sv" ? "sv" : "en"}>
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_12%_0%,rgba(139,195,157,0.28),transparent_35%),linear-gradient(180deg,#fff_0%,#f7f7f4_100%)]" />
      <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-start gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
        <div className="order-2 lg:order-1">
          <div className="mb-7 flex items-center gap-3 text-sm" aria-label={text.languageLabel}>
            <span className="font-semibold text-[#5b665f]">{text.languageLabel}:</span>
            <Link href={languageHref("sv", createdValue, planValue)} className={`rounded-full px-3 py-1.5 font-semibold ${locale === "sv" ? "bg-[#17452f] text-white" : "bg-white text-[#17452f] ring-1 ring-[#d7ded5]"}`}>SV</Link>
            <Link href={languageHref("en", createdValue, planValue)} className={`rounded-full px-3 py-1.5 font-semibold ${locale === "en" ? "bg-[#17452f] text-white" : "bg-white text-[#17452f] ring-1 ring-[#d7ded5]"}`}>EN</Link>
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]">{text.portal}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-[#17201a] sm:text-5xl">{text.heading}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5b665f]">{text.intro}</p>

          <div className="mt-8 grid gap-3 text-sm text-[#344139] sm:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]"><p className="font-semibold text-[#17201a]">{text.pilotTitle}</p><p className="mt-1 leading-6">{text.pilotText}</p></div>
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]"><p className="font-semibold text-[#17201a]">{text.helpTitle}</p><p className="mt-1 leading-6">{text.helpText}</p></div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#17452f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2">{text.demo}</Link>
            <Link href="/kontakt" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#17452f] bg-white px-6 py-3 text-sm font-semibold text-[#17452f] transition hover:bg-[#eef5ef] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2">{text.contact}</Link>
          </div>
        </div>

        <div className="order-1 w-full lg:order-2">
          {createdValue === "1" ? <p className="mb-4 rounded-xl border border-[#b8d9c2] bg-[#eef8f0] px-4 py-3 text-sm font-semibold text-[#17452f]" role="status">{text.created}</p> : null}
          <LoginForm afterLoginPath={afterLoginPath} locale={locale} />
        </div>
      </section>
    </main>
  );
}
