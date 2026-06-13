import type { Metadata } from "next";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata: Metadata = {
  title: "Logga in",
  description: "Inloggningssida för kommande Proffera-konton.",
};

export default function LoginPage() {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Logga in</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">
          Kund- och företagsinloggning kommer i en senare fas.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">
          Proffera bygger först public site, adminflöde, leads och e-postleverans. Separata konton för kunder och företag kommer när SaaS-dashboarden byggs ut.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <LockKeyhole className="h-8 w-8 text-[#17452f]" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold text-[#17201a]">Publik inloggning</h2>
            <p className="mt-2 text-sm leading-7 text-[#5b665f]">
              Kommande funktion för företag, kunder och teammedlemmar.
            </p>
          </article>
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <ShieldCheck className="h-8 w-8 text-[#17452f]" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-semibold text-[#17201a]">Admin</h2>
            <p className="mt-2 text-sm leading-7 text-[#5b665f]">
              Adminytan är separat skyddad och används inte som publik kundinloggning.
            </p>
          </article>
        </div>
        <div className="mt-8 flex gap-3">
          <ButtonLink href="/demo">Boka demo</ButtonLink>
          <ButtonLink href="/kontakt" variant="secondary">Kontakt</ButtonLink>
        </div>
      </section>
    </div>
  );
}
