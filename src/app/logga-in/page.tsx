import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Logga in | Proffera",
  description: "Kundportal för Proffera. Logga in för att komma åt din dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <main className="relative overflow-hidden bg-[#f7f7f4]">
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_12%_0%,rgba(139,195,157,0.28),transparent_35%),linear-gradient(180deg,#fff_0%,#f7f7f4_100%)]" />
      <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-start gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
        <div className="order-2 lg:order-1">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#17452f]">Proffera kundportal</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.04em] text-[#17201a] sm:text-5xl">
            Logga in till Proffera
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-[#5b665f]">
            Logga in med ditt Proffera-konto för att komma åt dashboard, kunder, leads och bokningar.
          </p>

          <div className="mt-8 grid gap-3 text-sm text-[#344139] sm:grid-cols-2">
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="font-semibold text-[#17201a]">För pilotkunder</p>
              <p className="mt-1 leading-6">Åtkomst öppnas när konto, workspace och behörigheter är aktiva.</p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-[#dfe5dd]">
              <p className="font-semibold text-[#17201a]">Behöver du hjälp?</p>
              <p className="mt-1 leading-6">Kontakta Proffera för demo, onboarding eller planerad åtkomst.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#17452f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2"
            >
              Boka demo
            </Link>
            <Link
              href="/kontakt"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#17452f] bg-white px-6 py-3 text-sm font-semibold text-[#17452f] transition hover:bg-[#eef5ef] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2"
            >
              Kontakta Proffera
            </Link>
          </div>
        </div>

        <div className="order-1 w-full lg:order-2">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
