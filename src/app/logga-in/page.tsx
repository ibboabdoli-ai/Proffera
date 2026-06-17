import type { Metadata } from "next";
import Link from "next/link";

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
            Kundinloggning för Proffera förbereds stegvis. Formuläret är en statisk förhandsversion och är ännu inte kopplat till riktig inloggning.
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

        <aside className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd] sm:p-8">
          <div className="inline-flex rounded-full bg-[#eef5ef] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#17452f]">
            Statisk förhandsversion
          </div>

          <h2 className="mt-5 text-2xl font-bold text-[#17201a]">Kundinloggning</h2>
          <p className="mt-3 text-sm leading-7 text-[#5b665f]">
            Formuläret visar den kommande inloggningsupplevelsen. Det skickar inte uppgifter och skapar ingen session ännu.
          </p>

          <form className="mt-6 grid gap-5" aria-describedby="login-static-note">
            <div>
              <label htmlFor="email" className="text-sm font-semibold text-[#17201a]">
                E-post
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="namn@foretag.se"
                disabled
                className="mt-2 w-full rounded-2xl border border-[#d7ded5] bg-[#f7f7f4] px-4 py-3 text-sm text-[#17201a] placeholder:text-[#8a958d] disabled:cursor-not-allowed disabled:opacity-80"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-semibold text-[#17201a]">
                Lösenord
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                disabled
                className="mt-2 w-full rounded-2xl border border-[#d7ded5] bg-[#f7f7f4] px-4 py-3 text-sm text-[#17201a] placeholder:text-[#8a958d] disabled:cursor-not-allowed disabled:opacity-80"
              />
            </div>

            <button
              type="button"
              disabled
              className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-[#17452f] px-6 py-3 text-sm font-semibold text-white opacity-70"
            >
              Logga in
            </button>
          </form>

          <p id="login-static-note" className="mt-4 text-xs leading-6 text-[#6a756e]">
            Inloggningen är inte aktiverad ännu. Riktig inloggning kopplas in i en senare fas när sessioner och workspace-behörigheter är verifierade.
          </p>
        </aside>
      </section>
    </main>
  );
}
