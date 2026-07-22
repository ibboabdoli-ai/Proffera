import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tack för ansökan",
  description: "Bekräftelse efter företagsregistrering hos Proffera.",
};

type PageProps = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function ThanksPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const reference = params.ref ?? "";

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-[#dfe5dd]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#17452f]">Företag</p>
        <h1 className="mt-4 text-4xl font-bold text-[#17201a]">Tack! Ansökan är mottagen.</h1>
        <p className="mt-4 text-[#5b665f]">
          Vi har tagit emot uppgifterna och återkommer om nästa steg för demo eller installation.
        </p>
        {reference ? (
          <p className="mt-6 rounded-2xl bg-[#eef5ef] p-4 font-semibold text-[#17452f]">
            Referensnummer: {reference}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white" href="/">
            Till startsidan
          </Link>
          <Link className="rounded-full border border-[#17452f] px-5 py-3 text-sm font-semibold text-[#17452f]" href="/anslut-foretag">
            Skicka en till ansökan
          </Link>
        </div>
      </section>
    </main>
  );
}
