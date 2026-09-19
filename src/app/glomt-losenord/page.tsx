import type { Metadata } from "next";
import authStyles from "@/components/auth/auth-marketplace.module.css";
import { PasswordResetRequestForm } from "./PasswordResetRequestForm";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const params = searchParams ? await searchParams : undefined;
  const locale: PasswordResetLocale = first(params?.lang) === "en" ? "en" : "sv";

  return {
    title: locale === "en" ? "Reset password" : "Glömt lösenord",
    description: locale === "en"
      ? "Request a secure Proffera password reset link."
      : "Begär en säker återställningslänk för ditt Proffera-konto.",
    robots: { index: false, follow: false },
  };
}

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
    <div className={authStyles.page} lang={locale}>
      <section className={authStyles.shell}>
        <div className={authStyles.single}>
          <div className={authStyles.languageRow} aria-label={text.language}>
            <span>{text.language}:</span>
            <a href="/glomt-losenord" className={`${authStyles.languageLink} ${locale === "sv" ? authStyles.languageActive : ""}`} aria-current={locale === "sv" ? "page" : undefined}>SV</a>
            <a href="/glomt-losenord?lang=en" className={`${authStyles.languageLink} ${locale === "en" ? authStyles.languageActive : ""}`} aria-current={locale === "en" ? "page" : undefined}>EN</a>
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
