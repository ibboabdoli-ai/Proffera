import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { getWorkspaceInvitation } from "@/features/company/workspace-invitation";
import { activateWorkspaceAction } from "./actions";
import { ActivationForm } from "./activation-form";

export const metadata: Metadata = {
  title: "Aktivera kundportal",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string | string[] }>;
};

const errorMessages: Record<string, string> = {
  password: "Lösenorden måste vara lika och innehålla minst 8 tecken.",
  expired: "Länken har gått ut. Be Proffera skicka en ny inbjudan.",
  account: "Kontot kunde inte skapas. Kontakta Proffera om e-postadressen redan används.",
  database: "Aktiveringen kunde inte slutföras just nu. Försök igen eller kontakta Proffera.",
  invalid: "Länken är ogiltig eller har redan använts.",
};

export default async function ActivationPage({ params, searchParams }: PageProps) {
  const [{ token }, query] = await Promise.all([
    params,
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const invitation = await getWorkspaceInvitation(token);
  const errorValue = Array.isArray(query?.error) ? query?.error[0] : query?.error;
  const action = activateWorkspaceAction.bind(null, token);

  if (!invitation) {
    return (
      <main className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
        <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-[#dfe5dd]">
          <h1 className="text-3xl font-bold text-[#17201a]">Länken kan inte användas</h1>
          <p className="mt-4 leading-7 text-[#5b665f]">Den är ogiltig, har gått ut eller har redan använts.</p>
          <Link href="/kontakt" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#17452f] px-5 py-3 text-sm font-bold text-white">Kontakta Proffera</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto grid max-w-4xl overflow-hidden rounded-[1.75rem] bg-white shadow-sm ring-1 ring-[#dfe5dd] lg:grid-cols-[0.85fr_1.15fr]">
        <section className="bg-[#102a1c] p-7 text-white sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Proffera kundportal</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-[-0.04em]">Aktivera {invitation.companyName}</h1>
          <ul className="mt-8 space-y-4 text-sm leading-6 text-white/85">
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#a9dbb9]" aria-hidden="true" />Egen säker arbetsyta.</li>
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#a9dbb9]" aria-hidden="true" />Kunder, bokningar och leads samlade.</li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#a9dbb9]" aria-hidden="true" />Inbjudan kan bara användas en gång.</li>
          </ul>
        </section>
        <section className="p-6 sm:p-10">
          <h2 className="text-2xl font-bold text-[#17201a]">Välj ditt lösenord</h2>
          <p className="mt-3 text-sm leading-6 text-[#5b665f]">Konto: <strong className="text-[#17201a]">{invitation.email}</strong></p>
          {errorValue ? <p className="mt-5 rounded-xl border border-[#e7b8b1] bg-[#fff4f2] px-4 py-3 text-sm font-semibold text-[#8a2b20]" role="alert">{errorMessages[errorValue] ?? errorMessages.invalid}</p> : null}
          <ActivationForm action={action} />
        </section>
      </div>
    </main>
  );
}
