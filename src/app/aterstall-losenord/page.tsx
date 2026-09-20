import type { Metadata } from "next";

import authStyles from "@/components/auth/auth-marketplace.module.css";
import { ResetPasswordForm } from "./ResetPasswordForm";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const params = searchParams ? await searchParams : undefined;
  const locale: PasswordResetLocale = first(params?.lang) === "en" ? "en" : "sv";

  return {
    title: locale === "en" ? "Choose a new password" : "Välj ett nytt lösenord",
    description: locale === "en"
      ? "Choose a new password for your Proffera account."
      : "Välj ett nytt lösenord för ditt Proffera-konto.",
    robots: { index: false, follow: false },
  };
}

type PasswordResetLocale = "sv" | "en";

const copy = {
  sv: {
    eyebrow: "Kontosäkerhet",
    title: "Välj ett nytt lösenord",
    intro: "Återställningslänken kan användas en gång. När lösenordet ändras avslutas dina tidigare Proffera-sessioner.",
  },
  en: {
    eyebrow: "Account security",
    title: "Choose a new password",
    intro: "The reset link can be used once. When the password changes, your previous Proffera sessions are revoked.",
  },
} as const;

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({
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
          <section className={authStyles.card}>
            <p className={authStyles.cardEyebrow}>{text.eyebrow}</p>
            <h1 className={authStyles.cardTitle}>{text.title}</h1>
            <p className={authStyles.cardLead}>{text.intro}</p>
            <div className="mt-5">
              <ResetPasswordForm locale={locale} />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
