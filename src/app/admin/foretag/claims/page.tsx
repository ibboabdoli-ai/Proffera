import { ArrowLeft, BadgeCheck, Building2, Clock3, Mail, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { listCompanyDirectoryClaims } from "@/lib/company-directory-claims-admin";
import { getSql } from "@/lib/db/server";

import {
  approveDirectoryClaimAction,
  rejectDirectoryClaimAction,
  releaseStaleDirectoryClaimReservationAction,
} from "./actions";

export const dynamic = "force-dynamic";

const RESERVATION_LEASE_MS = 15 * 60 * 1000;

function date(value: unknown) {
  if (!value) return "–";
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Stockholm" }).format(parsed)
    : "–";
}

function staleReservation(value: unknown) {
  if (!value) return false;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) && Date.now() - parsed.getTime() >= RESERVATION_LEASE_MS;
}

function parseManualEvidence(value: unknown) {
  const raw = String(value ?? "").split(" | ")[0]?.trim() ?? "";
  if (!raw.startsWith("manual;")) return null;
  const fields = new Map<string, string>();
  for (const part of raw.split(";").slice(1)) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    fields.set(part.slice(0, index), part.slice(index + 1));
  }
  return {
    name: fields.get("name") ?? "",
    role: fields.get("role") ?? "",
    businessEmail: fields.get("business_email") ?? "",
    phone: fields.get("phone") ?? "",
    accountEmail: fields.get("account_email") ?? "",
  };
}

export default async function DirectoryClaimsPage() {
  await requireSuperAdmin();
  const { rows } = await listCompanyDirectoryClaims();
  const pending = rows.filter((row) => row.status === "pending" || row.status === "verified");

  const sql = getSql();
  const evidenceRows = sql ? await sql`
    select id::text, verification_reference
    from company_directory_claims
    where status in ('pending', 'verified')
    order by requested_at desc
    limit 250
  ` : [];
  const evidenceByClaim = new Map(evidenceRows.map((row) => [String(row.id), String(row.verification_reference ?? "")]));

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <Link href="/admin/foretag" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#17452f] hover:bg-[#e7f1eb]">
          <ArrowLeft className="h-4 w-4" /> Företag
        </Link>

        <div className="mt-6 rounded-[1.75rem] bg-[#102a1c] p-7 text-white sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Company Profile Engine</p>
          <h1 className="mt-3 text-3xl font-bold">Anspråk som måste verifieras</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Godkänn bara när du har bevis för att personen får företräda företaget. Ett godkännande skapar eller återanvänder en bestämd workspace och gör användaren till owner.
          </p>
          <div className="mt-5 inline-flex rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold ring-1 ring-white/15">
            {pending.length} väntar på beslut
          </div>
        </div>

        <div className="mt-7 grid gap-5">
          {pending.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-sm text-[#667168] ring-1 ring-black/5">Inga väntande anspråk.</div>
          ) : pending.map((row) => {
            const ownsReservation = Boolean(row.claim_reservation_id) && String(row.claim_reservation_id) === String(row.id);
            const reservationStale = ownsReservation && staleReservation(row.claim_reserved_at);
            const reservationActive = ownsReservation && !reservationStale;
            const evidence = parseManualEvidence(evidenceByClaim.get(String(row.id)));

            return (
              <article key={String(row.id)} className="rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-black/5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#fdf1d4] px-3 py-1 text-xs font-bold text-[#805d14]">{String(row.status)}</span>
                      <span className="rounded-full bg-[#eef0ed] px-3 py-1 text-xs font-bold text-[#536057]">Datakvalitet {Number(row.quality_score) || 0}/100</span>
                      <span className="rounded-full bg-[#e9f1ec] px-3 py-1 text-xs font-bold text-[#17452f]">{String(row.verification_method) === "bankid" ? "BankID" : "Manuell verifiering"}</span>
                      {ownsReservation ? (
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${reservationStale ? "bg-[#fff0ee] text-[#8c3327]" : "bg-[#e8f0ff] text-[#34508b]"}`}>
                          {reservationStale ? "Fast reservation" : "Provisionering pågår"}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-xl font-black text-[#17201a]">{String(row.display_name)}</h2>
                    <div className="mt-3 grid gap-2 text-sm text-[#5c675f] sm:grid-cols-2">
                      <p className="flex items-center gap-2"><Building2 className="h-4 w-4" /> {String(row.legal_form || "–")} · {String(row.city || "–")}</p>
                      <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {String(row.claimant_email)}</p>
                      <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> {String(row.primary_sni_code || "–")} {String(row.primary_sni_label || "")}</p>
                      <p className="flex items-center gap-2"><BadgeCheck className="h-4 w-4" /> Konto-e-post {row.claimant_email_verified ? "verifierad" : "inte verifierad"}</p>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[#dce6df] bg-[#f8fbf9] p-4">
                      <p className="flex items-center gap-2 text-sm font-black text-[#17452f]"><UserCheck className="h-4 w-4" /> Underlag från den sökande</p>
                      {evidence ? (
                        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                          <div><dt className="text-[#778078]">Namn</dt><dd className="font-bold text-[#253129]">{evidence.name || "–"}</dd></div>
                          <div><dt className="text-[#778078]">Roll</dt><dd className="font-bold text-[#253129]">{evidence.role || "–"}</dd></div>
                          <div><dt className="text-[#778078]">Företagsmejl</dt><dd className="break-all font-bold text-[#253129]">{evidence.businessEmail || "–"}</dd></div>
                          <div><dt className="text-[#778078]">Telefon</dt><dd className="font-bold text-[#253129]">{evidence.phone && evidence.phone !== "-" ? evidence.phone : "Ej angivet"}</dd></div>
                          <div className="sm:col-span-2"><dt className="text-[#778078]">Proffera-konto som skickade anspråket</dt><dd className="break-all font-bold text-[#253129]">{evidence.accountEmail || String(row.claimant_email)}</dd></div>
                        </dl>
                      ) : (
                        <p className="mt-2 text-sm leading-6 text-[#687169]">Äldre anspråk utan det nya verifieringsunderlaget. Begär komplettering eller verifiera manuellt innan du godkänner.</p>
                      )}
                    </div>

                    <p className="mt-3 text-xs text-[#7a837c]">Begärd {date(row.requested_at)} · Källa: {String(row.official_source || "–")}</p>
                    {ownsReservation ? <p className="mt-2 flex items-center gap-1.5 text-xs text-[#6c756f]"><Clock3 className="h-3.5 w-3.5" /> Reservation sedan {date(row.claim_reserved_at)}</p> : null}
                    <a href={`/foretag/listad/${encodeURIComponent(String(row.public_slug))}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-bold text-[#17452f] underline underline-offset-4">
                      Öppna publik profil
                    </a>
                  </div>

                  <div className="w-full max-w-md space-y-3">
                    <form action={approveDirectoryClaimAction} className="rounded-2xl border border-[#cfe1d4] bg-[#f3f8f4] p-4">
                      <input type="hidden" name="claimId" value={String(row.id)} />
                      <label className="text-xs font-black uppercase tracking-wide text-[#43604c]" htmlFor={`reference-${String(row.id)}`}>Verifieringsbevis</label>
                      <textarea
                        id={`reference-${String(row.id)}`}
                        name="reference"
                        required
                        minLength={3}
                        maxLength={500}
                        placeholder="Exempel: företagsmejl bekräftat + firmatecknare kontrollerad mot officiell källa"
                        className="mt-2 min-h-20 w-full rounded-xl border border-[#cad8ce] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20"
                      />
                      <button type="submit" disabled={!row.claimant_email_verified || reservationActive} className="mt-3 min-h-11 w-full rounded-xl bg-[#17452f] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                        {reservationStale ? "Försök provisionering igen" : reservationActive ? "Provisionering pågår" : "Verifiera och skapa workspace"}
                      </button>
                    </form>

                    {reservationStale ? (
                      <form action={releaseStaleDirectoryClaimReservationAction} className="rounded-2xl border border-[#e7d29c] bg-[#fff9e9] p-4">
                        <input type="hidden" name="claimId" value={String(row.id)} />
                        <label className="text-xs font-black uppercase tracking-wide text-[#76580d]" htmlFor={`recovery-${String(row.id)}`}>Återställ fast reservation</label>
                        <p className="mt-2 text-xs leading-5 text-[#6f654c]">Använd bara om provisioneringen avbröts och ingen workspace skapades. Backend vägrar återställning om den reserverade workspacen redan finns.</p>
                        <input
                          id={`recovery-${String(row.id)}`}
                          name="reason"
                          required
                          minLength={3}
                          maxLength={500}
                          placeholder="Orsak till återställning"
                          className="mt-3 min-h-11 w-full rounded-xl border border-[#dfcfaa] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#76580d]/15"
                        />
                        <button type="submit" className="mt-3 min-h-11 w-full rounded-xl border border-[#d5bd7c] bg-white px-4 text-sm font-black text-[#76580d]">Frigör stale reservation</button>
                      </form>
                    ) : null}

                    <form action={rejectDirectoryClaimAction} className="rounded-2xl border border-[#ead3ce] bg-[#fff8f6] p-4">
                      <input type="hidden" name="claimId" value={String(row.id)} />
                      <label className="text-xs font-black uppercase tracking-wide text-[#7d4a40]" htmlFor={`reason-${String(row.id)}`}>Avslagsorsak</label>
                      <input
                        id={`reason-${String(row.id)}`}
                        name="reason"
                        required
                        minLength={3}
                        maxLength={500}
                        placeholder="Varför anspråket inte kan godkännas"
                        className="mt-2 min-h-11 w-full rounded-xl border border-[#e2cbc6] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#9a3024]/15"
                      />
                      <button type="submit" disabled={ownsReservation} className="mt-3 min-h-11 w-full rounded-xl border border-[#d8a69d] bg-white px-4 text-sm font-black text-[#8b3024] disabled:cursor-not-allowed disabled:opacity-40">Avslå</button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
