import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PreviewAdminSetupForm } from "./PreviewAdminSetupForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview account setup | Proffera",
  description: "Create a temporary account in the isolated Proffera Preview environment.",
  robots: { index: false, follow: false },
};

export default function PreviewAdminSetupPage() {
  if (process.env.VERCEL_ENV !== "preview") notFound();

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-12 sm:px-6">
      <section className="mx-auto max-w-xl rounded-[1.75rem] border border-white bg-white p-6 shadow-2xl shadow-[#17452f]/10 ring-1 ring-[#dfe5dd] sm:p-8">
        <div className="inline-flex rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#17452f]">
          Preview only
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-[-0.03em] text-[#17201a]">Skapa Preview-konto</h1>
        <p className="mt-3 text-sm leading-7 text-[#5b665f]">
          Kontot skapas endast i den isolerade Preview-databasen. Sidan finns inte i Production och ger inte adminbehörighet automatiskt.
        </p>
        <PreviewAdminSetupForm />
      </section>
    </main>
  );
}
