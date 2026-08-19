import Link from "next/link";
import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { enrichCompanyDirectoryScbForProfile } from "@/lib/company-directory-scb-enrichment";
import { getSql } from "@/lib/db/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    scb?: string | string[];
  }>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

async function refreshScbEnrichmentAction(formData: FormData) {
  "use server";

  await requireSuperAdmin();
  const profileId = text(formData.get("profileId"));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    redirect("/admin/foretag/directory/scb?scb=invalid");
  }

  try {
    const result = await enrichCompanyDirectoryScbForProfile(profileId);
    const code = result.status === "saved" && result.conflicts.length > 0
      ? "conflict"
      : result.status;
    redirect(`/admin/foretag/directory/scb?scb=${encodeURIComponent(code)}`);
  } catch (error) {
    console.error("Manual SCB enrichment failed", error);
    redirect("/admin/foretag/directory/scb?scb=error");
  }
}

const resultMessages: Record<string, { ok: boolean; text: string }> = {
  saved: { ok: true, text: "SCB-data hämtades och sparades utan konflikt." },
  conflict: { ok: false, text: "SCB-data sparades, men en konflikt med Bolagsverket kräver granskning." },
  disabled: { ok: false, text: "SCB-integrationen är avstängd i den här miljön." },
  awaiting_access: { ok: false, text: "SCB-integrationen saknar certifikat eller åtkomst i den här miljön." },
  ineligible: { ok: false, text: "Profilen är inte en svensk juridisk person som kan hämtas från SCB." },
  invalid: { ok: false, text: "Ogiltigt profil-ID." },
  error: { ok: false, text: "SCB-hämtningen misslyckades. Ingen publicering gjordes." },
};

export default async function CompanyDirectoryScbAdminPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const sql = getSql();
  const params = await (searchParams ?? Promise.resolve(undefined));
  const resultCode = firstParam(params?.scb) ?? "";
  const message = resultMessages[resultCode];
  const enabled = process.env.SCB_COMPANY_REGISTRY_ENABLED?.trim().toLowerCase() === "true";

  const profiles = sql ? await sql`
    select
      p.id::text,
      p.organization_number,
      p.display_name,
      p.city,
      p.publication_status,
      s.last_synced_at::text as scb_last_synced_at,
      coalesce(jsonb_array_length(s.conflicts), 0)::int as scb_conflict_count,
      coalesce(jsonb_array_length(s.workplaces), 0)::int as scb_workplace_count
    from company_directory_profiles p
    left join company_directory_scb_enrichment s on s.profile_id = p.id
    where p.country_code = 'SE'
      and p.organization_kind = 'juridical_person'
      and length(regexp_replace(p.organization_number, '\\D', '', 'g')) = 10
    order by
      case when upper(coalesce(p.city, '')) = 'SÖDERTÄLJE' then 0 else 1 end,
      s.last_synced_at asc nulls first,
      p.updated_at desc
    limit 25
  ` : [];

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-4 rounded-[1.75rem] bg-[#102a1c] p-7 text-white sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Company Directory · SCB</p>
            <h1 className="mt-2 text-3xl font-black">SCB enrichment</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
              Hämtar kontakt-, arbetsställe- och SNI-data från SCB utan att skriva över Bolagsverkets juridiska fakta eller publicera profilen.
            </p>
          </div>
          <Link href="/admin/foretag/directory" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-[#173e2b]">
            Till Directory
          </Link>
        </div>

        <div className={`mt-6 rounded-2xl border p-5 text-sm font-semibold ${enabled ? "border-[#b8d9c2] bg-[#eef8f0] text-[#17452f]" : "border-[#ddc98f] bg-[#fff9e8] text-[#665019]"}`}>
          SCB är {enabled ? "aktiverat i den här miljön." : "avstängt i den här miljön. Ingen SCB-förfrågan görs."}
        </div>

        {message ? (
          <div className={`mt-4 rounded-2xl border p-5 text-sm font-semibold ${message.ok ? "border-[#b8d9c2] bg-[#eef8f0] text-[#17452f]" : "border-[#e7b8b1] bg-[#fff4f2] text-[#8a2b20]"}`} role="status">
            {message.text}
          </div>
        ) : null}

        <section className="mt-7 overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-black/5">
          <div className="border-b border-black/5 p-5">
            <h2 className="text-xl font-black text-[#17201a]">Profiler för manuell enrichment</h2>
            <p className="mt-1 text-sm text-[#747e77]">Södertälje prioriteras. Åtgärden ändrar inte publikationsstatus.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-[#6b766e]">
                <tr>
                  <th className="px-4 py-3">Företag</th>
                  <th className="px-4 py-3">Org.nr</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">SCB</th>
                  <th className="px-4 py-3">Åtgärd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {profiles.map((profile) => (
                  <tr key={text(profile.id)}>
                    <td className="px-4 py-4">
                      <p className="font-bold text-[#253129]">{text(profile.display_name)}</p>
                      <p className="mt-1 text-xs text-[#747e77]">{text(profile.city) || "–"}</p>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">{text(profile.organization_number)}</td>
                    <td className="px-4 py-4">{text(profile.publication_status)}</td>
                    <td className="px-4 py-4 text-xs text-[#5f6a62]">
                      {profile.scb_last_synced_at ? (
                        <>
                          <p>Hämtad</p>
                          <p>{Number(profile.scb_workplace_count) || 0} arbetsställen · {Number(profile.scb_conflict_count) || 0} konflikter</p>
                        </>
                      ) : "Inte hämtad"}
                    </td>
                    <td className="px-4 py-4">
                      <form action={refreshScbEnrichmentAction}>
                        <input type="hidden" name="profileId" value={text(profile.id)} />
                        <button type="submit" disabled={!enabled} className="min-h-10 rounded-xl bg-[#17452f] px-4 py-2 text-sm font-black text-white transition enabled:hover:bg-[#123724] disabled:cursor-not-allowed disabled:opacity-40">
                          Hämta SCB
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!profiles.length ? (
                  <tr><td className="px-4 py-8 text-center text-[#747e77]" colSpan={5}>Inga profiler hittades.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
