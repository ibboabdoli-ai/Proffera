import { ArrowLeft, BadgeCheck, Building2, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { listPendingSoleTraderDirectoryClaims } from "@/lib/company-directory-sole-trader-admin";

import { approveSoleTraderClaimAction, rejectSoleTraderClaimAction } from "./actions";

export const dynamic = "force-dynamic";

function date(value: unknown) {
  if (!value) return "–";
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("sv-SE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Stockholm",
      }).format(parsed)
    : "–";
}

export default async function SoleTraderClaimsPage() {
  await requireSuperAdmin();
  const { rows } = await listPendingSoleTraderDirectoryClaims();

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/admin/foretag/claims"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#17452f] hover:bg-[#e7f1eb]"
        >
          <ArrowLeft className="h-4 w-4" /> Anspråk
        </Link>

        <div className="mt-6 rounded-[1.75rem] bg-[#102a1c] p-7 text-white sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Enskild firma · integritetssäker kontroll</p>
          <h1 className="mt-3 text-3xl font-bold">Ägargranskning</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Bolagsverket-identiteten har redan kontrollerats server-side och har därefter kastats bort. Den här vyn visar bara företagsuppgifter som behövs för beslutet. Skriv aldrig personnummer i verifieringsbeviset.
          </p>
          <div className="mt-5 inline-flex rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold ring-1 ring-white/15">
            {rows.length} väntar på granskning
          </div>
        </div>

        <div className="mt-7 grid gap-5">
          {rows.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-[#667168] ring-1 ring-black/5">
              Inga enskilda firmor väntar på ägargranskning.
            </div>
          ) : rows.map((row) => (
            <article key={String(row.id)} className="rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-black/5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#fdf1d4] px-3 py-1 text-xs font-bold text-[#805d14]">{String(row.status)}</span>
                    <span className="rounded-full bg-[#e4f2e8] px-3 py-1 text-xs font-bold text-[#17452f]">Bolagsverket · enskild firma</span>
                    <span className="rounded-full bg-[#eef0ed] px-3 py-1 text-xs font-bold text-[#536057]">Datakvalitet {Number(row.quality_score) || 0}/100</span>
                  </div>

                  <h2 className="mt-3 text-xl font-black text-[#17201a]">{String(row.display_name)}</h2>
                  <div className="mt-3 grid gap-2 text-sm text-[#5c675f] sm:grid-cols-2">
                    <p className="flex items-center gap-2"><Building2 className="h-4 w-4" /> {String(row.legal_form || "Enskild näringsidkare")}</p>
                    <p className="flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> {String(row.organization_status || "Registrerad")}</p>
                    <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> {String(row.primary_sni_code || "SNI saknas")} {String(row.primary_sni_label || "")}</p>
                    <p className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> {String(row.claimant_name || "–")} · {String(row.claimant_email || "–")}</p>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#dce6df] bg-[#f8fbf9] p-4 text-sm text-[#536057]">
                    <p><strong>Arbetsyta:</strong> {String(row.workspace_company_name || row.workspace_name || "–")}</p>
                    <p className="mt-1"><strong>Ort:</strong> {String(row.city || "–")}</p>
                    <p className="mt-1"><strong>Verksamhet:</strong> {String(row.activity_description || "–")}</p>
                    <p className="mt-2 text-xs text-[#788178]">Begärd {date(row.requested_at)} · Källa: Bolagsverket Värdefulla datamängder</p>
                  </div>
                </div>

                <div className="w-full max-w-md space-y-3">
                  <form action={approveSoleTraderClaimAction} className="rounded-2xl border border-[#cfe1d4] bg-[#f3f8f4] p-4">
                    <input type="hidden" name="claimId" value={String(row.id)} />
                    <label className="text-xs font-black uppercase tracking-wide text-[#43604c]" htmlFor={`reference-${String(row.id)}`}>Verifieringsbevis</label>
                    <textarea
                      id={`reference-${String(row.id)}`}
                      name="reference"
                      required
                      minLength={3}
                      maxLength={500}
                      placeholder="Exempel: innehavarskap kontrollerat i Bolagsverket Mina sidor. Ange inte personnummer."
                      className="mt-2 min-h-24 w-full rounded-xl border border-[#cad8ce] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20"
                    />
                    <p className="mt-2 text-xs leading-5 text-[#5f6c63]">
                      Godkänn bara när du har kontrollerat att den inloggade användaren är registrerad innehavare. Personidentifieraren får inte kopieras hit.
                    </p>
                    <button type="submit" className="mt-3 min-h-11 w-full rounded-xl bg-[#17452f] px-4 text-sm font-black text-white">
                      Verifiera och koppla till workspace
                    </button>
                  </form>

                  <form action={rejectSoleTraderClaimAction} className="rounded-2xl border border-[#ead3ce] bg-[#fff8f6] p-4">
                    <input type="hidden" name="claimId" value={String(row.id)} />
                    <label className="text-xs font-black uppercase tracking-wide text-[#7d4a40]" htmlFor={`reason-${String(row.id)}`}>Avslagsorsak</label>
                    <input
                      id={`reason-${String(row.id)}`}
                      name="reason"
                      required
                      minLength={3}
                      maxLength={500}
                      placeholder="Varför ägarverifieringen inte kan godkännas"
                      className="mt-2 min-h-11 w-full rounded-xl border border-[#e2cbc6] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#9a3024]/15"
                    />
                    <button type="submit" className="mt-3 min-h-11 w-full rounded-xl border border-[#d8a69d] bg-white px-4 text-sm font-black text-[#8b3024]">Avslå</button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
