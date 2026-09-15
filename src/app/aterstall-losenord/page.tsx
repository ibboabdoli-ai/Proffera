import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password | Proffera",
  description: "Choose a new password for your Proffera account.",
  robots: { index: false, follow: false },
};

type PasswordResetLocale = "sv" | "en";

const copy = {
  sv: {
    eyebrow: "Kontosäkerhet",
    title: "Välj ett nytt lösenord",
    intro: "Återställningslänken kan användas en gång. När lösenordet ändras avslutas dina tidigare Proffera-sessioner.",
    language: "Språk",
  },
  en: {
    eyebrow: "Account security",
    title: "Choose a new password",
    intro: "The reset link can be used once. When the password changes, your previous Proffera sessions are revoked.",
    language: "Language",
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
    <main className="relative min-h-[calc(100vh-5rem)] overflow-hidden bg-[#f7f7f4]" lang={locale}>
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_12%_0%,rgba(139,195,157,0.28),transparent_35%),linear-gradient(180deg,#fff_0%,#f7f7f4_100%)]" />
      <section className="relative mx-auto flex max-w-2xl flex-col px-4 py-12 sm:px-6 lg:py-20">
        <div className="mb-6 flex items-center gap-3 text-sm" aria-label={text.language}>
          <span className="font-semibold text-[#5b665f]">{text.language}:</span>
          <Link href="/aterstall-losenord" className={`rounded-full px-3 py-1.5 font-semibold ${locale === "sv" ? "bg-[#17452f] text-white" : "bg-white text-[#17452f] ring-1 ring-[#d7ded5]"}`}>SV</Link>
          <Link href="/aterstall-losenord?lang=en" className={`rounded-full px-3 py-1.5 font-semibold ${locale === "en" ? "bg-[#17452f] text-white" : "bg-white text-[#17452f] ring-1 ring-[#d7ded5]"}`}>EN</Link>
        </div>
        <div className="rounded-[1.75rem] border border-white bg-white p-6 shadow-2xl shadow-[#17452f]/10 ring-1 ring-[#dfe5dd] sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#17452f]">{text.eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em] text-[#17201a]">{text.title}</h1>
          <p className="mt-4 text-sm leading-7 text-[#5b665f]">{text.intro}</p>
          <div className="mt-7">
            <ResetPasswordForm locale={locale} />
          </div>
        </div>
      </section>
    </main>
  );
}
