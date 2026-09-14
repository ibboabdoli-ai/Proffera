import { ArrowLeft, Building2, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { addCompanyDirectoryFromAdminAction } from "./actions";

export const dynamic = "force-dynamic";

const statusMessages: Record<string, { tone: "green" | "amber" | "red"; text: string }> = {
  added: {
    tone: "green",
    text: "Företaget verifierades mot officiell källa och lades till i Directory. Publicering skedde bara om de befintliga säkerhetskraven var uppfyllda.",
  },
  existing: {
    tone: "green",
    text: "Företaget finns redan i Company Directory. Ingen Workspace-koppling eller ägarstatus ändrades.",
  },
  review: {
    tone: "amber",
    text: "Företaget verifierades och finns i Directory, men publiceringskraven är inte uppfyllda ännu. Profilen förblir opublicerad.",
  },
  not_ready: {
    tone: "amber",
    text: "Den officiella kontrollen gav inte ett underlag som kan läggas till eller publiceras säkert.",
  },
  private_identity: {
    tone: "amber",
    text: "Den här identitetstypen får inte användas i adminflödet. Enskild firma och privata identiteter måste använda den befintliga integritetssäkra ägar- och claimprocessen.",
  },
  invalid: {
    tone: "red",
    text: "Kontrollera organisationsnumret. Ange ett svenskt organisationsnummer med 10 siffror.",
  },
  rate_limited: {
    tone: "amber",
    text: "För många officiella kontroller har gjorts på kort tid. Försök igen senare.",
  },
  source_error: {
    tone: "red",
    text: "Den officiella verifieringen kunde inte slutföras just nu. Ingen osäker profil skapades.",
  },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAddCompanyDirectoryPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string | string[] }>;
}) {
  await requireSuperAdmin();
  const params = searchParams ? await searchParams : undefined;
  const message = statusMessages[first(params?.status) ?? ""];

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl">
        <Link
          href="/admin/foretag/directory"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#17452f] hover:bg-[#e7f1eb]"
        >
          <ArrowLeft className="h-4 w-4" /> Directory Engine
        </Link>

        <header className="mt-6 rounded-[1.75rem] bg-[#102a1c] p-7 text-white sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">
            Company Directory · Super-admin
          </p>
          <h1 className="mt-2 text-3xl font-black">Lägg till företag</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Ange ett svenskt organisationsnummer. Proffera verifierar exakt företagsidentitet mot den
            officiella källan innan Directory-data kan sparas.
          </p>
        </header>

        {message ? (
          <div
            role="status"
            className={`mt-6 rounded-2xl border p-5 text-sm font-semibold ${
              message.tone === "green"
                ? "border-[#b8d9c2] bg-[#eef8f0] text-[#17452f]"
                : message.tone === "red"
                  ? "border-[#e7b8b1] bg-[#fff4f2] text-[#8a2b20]"
                  : "border-[#ddc98f] bg-[#fff9e8] text-[#665019]"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <section className="mt-6 rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
          <div className="flex items-start gap-3">
            <Building2 className="mt-1 h-6 w-6 text-[#17452f]" />
            <div>
              <h2 className="text-xl font-black text-[#17201a]">Svenskt organisationsnummer</h2>
              <p className="mt-2 text-sm leading-6 text-[#667168]">
                Ingen Workspace väljs eller skapas här. Åtgärden gäller endast Company Directory.
              </p>
            </div>
          </div>

          <form action={addCompanyDirectoryFromAdminAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="grid gap-2 text-sm font-bold text-[#334139]">
              Organisationsnummer
              <input
                name="organizationNumber"
                required
                inputMode="numeric"
                autoComplete="off"
                placeholder="556123-4567"
                className="min-h-12 rounded-xl border border-[#cad8ce] bg-white px-4 text-base outline-none focus:ring-2 focus:ring-[#17452f]/20"
              />
            </label>
            <button
              type="submit"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#173e2b] px-6 text-sm font-black text-white"
            >
              Kontrollera och lägg till
            </button>
          </form>
        </section>

        <section className="mt-6 flex gap-3 rounded-2xl border border-[#d6e2d8] bg-[#f1f7f2] p-5 text-sm leading-6 text-[#465349]">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#17452f]" />
          <div>
            <p className="font-black text-[#17452f]">Säkerhetsgräns</p>
            <p className="mt-1">
              Flödet skapar inte Workspace-medlemskap, claimar inte företaget och ändrar inte
              <code className="mx-1 rounded bg-white px-1.5 py-0.5">claimed_workspace_id</code>.
              Enskild firma och privata identiteter stoppas före persistens.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
