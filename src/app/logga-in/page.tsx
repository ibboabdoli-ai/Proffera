import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Logga in | Proffera",
  description: "Kundportal för Proffera. Inloggning och kundkonto förbereds för pilotkunder.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <main className="bg-[#f7f7f4]">
      <section className="mx-auto grid min-h-[70vh] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Proffera kundportal</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">
            Logga in till Proffera
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5b665f]">
            Kundinloggning för Proffera förbereds stegvis. Formuläret kan nu skicka inloggningsuppgifter, medan dashboard-skydd och Basic Auth fortfarande är oförändrade.
          </p>

          <div className="mt-8 grid gap-3 text-sm text-[#344139] sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="font-semibold text-[#17201a]">För pilotkunder</p>
              <p className="mt-1 leading-6">Åtkomst öppnas först när konto, workspace och behörigheter är verifierade.</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="font-semibold text-[#17201a]">Behöver du hjälp?</p>
              <p className="mt-1 leading-6">Kontakta Proffera för demo, onboarding eller planerad åtkomst.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex items-center justify-center rounded-full bg-[#17452f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2"
            >
              Boka demo
            </Link>
            <Link
              href="/kontakt"
              className="inline-flex items-center justify-center rounded-full border border-[#17452f] bg-white px-6 py-3 text-sm font-semibold text-[#17452f] transition hover:bg-[#eef5ef] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2"
            >
              Kontakta Proffera
            </Link>
          </div>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
