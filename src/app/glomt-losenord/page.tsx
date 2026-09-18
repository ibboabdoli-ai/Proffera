import type { Metadata } from "next";
import Link from "next/link";

import authStyles from "@/components/auth/auth-marketplace.module.css";
import { PasswordResetRequestForm } from "./PasswordResetRequestForm";

export const metadata: Metadata = {
  title: "Reset password | Proffera",
  description: "Request a secure Proffera password reset link.",
  robots: { index: false, follow: false },
};

type PasswordResetLocale = "sv" | "en";

const copy = {
  sv: {
    eyebrow: "Kontosäkerhet",
    title: "Glömt lösenordet?",
    intro: "Ange e-postadressen för ditt Proffera-konto. Av säkerhetsskäl visar vi inte om adressen finns registrerad.",
    language: "Språk",
  },
  en: {
    eyebrow: "Account security",
    title: "Forgot your password?",
    intro: "Enter the email address for your Proffera account. For security, we do not reveal whether the address is registered.",
    language: "Language",
  },
} as const;

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const locale: PasswordResetLocale = first(params?.lang) === "en" ? "en" : "sv";
  const text = copy[locale];

  return (
    <main className={authStyles.page} lang={locale}>
      <section className={authStyles.shell}>
        <div className={authStyles.single}>
          <div className={authStyles.languageRow} aria-label={text.language}>
            <span>{text.language}:</span>
            <Link href="/glomt-losenord" className={`${authStyles.languageLink} ${locale === "sv" ? authStyles.languageActive : ""}`}>SV</Link>
            <Link href="/glomt-losenord?lang=en" className={`${authStyles.languageLink} ${locale === "en" ? authStyles.languageActive : ""}`}>EN</Link>
          </div>

          <section className={authStyles.card}>
            <p className={authStyles.cardEyebrow}>{text.eyebrow}</p>
            <h1 className={authStyles.cardTitle}>{text.title}</h1>
            <p className={authStyles.cardLead}>{text.intro}</p>
            <div className="mt-5">
              <PasswordResetRequestForm locale={locale} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
