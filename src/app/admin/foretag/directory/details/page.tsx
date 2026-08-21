import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { getSql } from "@/lib/db/server";

export const dynamic = "force-dynamic";

const PROFILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
  searchParams?: Promise<{ q?: string | string[]; profile?: string | string[] }>;
};

type JsonRecord = Record<string, unknown>;

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function pretty(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "–";
  }
}

function formatDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "–";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return raw;
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Europe/Stockholm",
  }).format(date);
}

function address(value: unknown) {
  const row = record(value);
  const line = [text(row.careOf), text(row.addressLine)].filter(Boolean).join(", ");
  const locality = [text(row.postalCode), text(row.city)].filter(Boolean).join(" ");
  return [line, locality].filter(Boolean).join(", ") || "–";
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-black/5 bg-[#f7f8f5] p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#748078]">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-[#243129]">{show(value)}</p>
    </div>
  );
}

function Raw({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="rounded-2xl border border-black/5 bg-white p-4">
      <summary className="cursor-pointer text-sm font-black text-[#17452f]">{label}</summary>
      <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#102a1c] p-4 text-xs leading-5 text-[#d9f1e0]">{pretty(value)}</pre>
    </details>
  );
}

export default async function DirectoryAdminDetailsPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const sql = getSql();
  const params = await (searchParams ?? Promise.resolve(undefined));
  const query = (firstParam(params?.q) ?? "").trim().slice(0, 120);
  const profileId = (firstParam(params?.profile) ?? "").trim();

  if (!sql) {
    return <main className="p-8">Databasen är inte tillgänglig i den här miljön.</main>;
  }

  const queryPattern = `%${query}%`;
  const searchRows = await sql`
    select
      p.id::text, p.display_name, p.legal_name, p.organization_number,
      p.publication_status, p.quality_score, p.city, p.category_slug,
      scb.last_synced_at as scb_last_synced_at,
      coalesce(jsonb_array_length(scb.conflicts), 0)::int as scb_conflict_count
    from company_directory_profiles p
    left join company_directory_scb_enrichment scb on scb.profile_id = p.id
    where (
      ${query}::text = ''
      or coalesce(p.display_name, '') ilike ${queryPattern}
      or coalesce(p.legal_name, '') ilike ${queryPattern}
      or coalesce(p.organization_number, '') ilike ${queryPattern}
      or coalesce(p.public_slug, '') ilike ${queryPattern}
    )
    order by
      case when p.publication_status = 'published' then 0 else 1 end,
      scb.last_synced_at desc nulls last,
      p.updated_at desc,
      p.id
    limit 50
  `;

  let selected: JsonRecord | null = null;
  let services: unknown[] = [];
  let locations: unknown[] = [];
  let sources: unknown[] = [];

  if (PROFILE_ID_RE.test(profileId)) {
    const rows = await sql`
      select
        to_jsonb(p) as profile,
        to_jsonb(facts) as official_facts,
        to_jsonb(scb) as scb,
        (
          facts.profile_id is not null
          and facts.source_payload_hash <> ''
          and facts.last_synced_at >= p.last_synced_at
        ) as official_facts_fresh,
        (
          scb.profile_id is not null
          and scb.source_payload_hash <> ''
          and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = p.updated_at::text
          and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = facts.last_synced_at::text
        ) as scb_snapshot_fresh,
        coalesce(jsonb_array_length(scb.conflicts), 0)::int as scb_conflict_count
      from company_directory_profiles p
      left join company_directory_official_facts facts on facts.profile_id = p.id
      left join company_directory_scb_enrichment scb on scb.profile_id = p.id
      where p.id = ${profileId}::uuid
      limit 1
    `;
    selected = rows[0] ? rows[0] as JsonRecord : null;

    if (selected) {
      const [serviceRows, locationRows, sourceRows] = await Promise.all([
        sql`select to_jsonb(service) as value from company_directory_profile_services service where service.profile_id = ${profileId}::uuid order by service.created_at, service.id`,
        sql`select to_jsonb(location) as value from company_directory_business_locations location where location.profile_id = ${profileId}::uuid order by location.created_at, location.id`,
        sql`select to_jsonb(source) as value from company_directory_field_sources source where source.profile_id = ${profileId}::uuid order by source.observed_at desc nulls last, source.created_at desc, source.id limit 100`,
      ]);
      services = serviceRows.map((row) => (row as JsonRecord).value);
      locations = locationRows.map((row) => (row as JsonRecord).value);
      sources = sourceRows.map((row) => (row as JsonRecord).value);
    }
  }

  const profile = record(selected?.profile);
  const facts = record(selected?.official_facts);
  const scb = record(selected?.scb);
  const workplaces = list(scb.workplaces).map(record);
  const conflicts = list(scb.conflicts);
  const publicSlug = text(profile.public_slug);

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <header className="rounded-[1.75rem] bg-[#102a1c] p-7 text-white sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Company Directory · Admin</p>
          <h1 className="mt-2 text-3xl font-black">Fullständigt företagsunderlag</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">Intern super-adminvy för profil, Official Facts, SCB, arbetsställen, kontaktdata, adresser, källor och freshness. Detta ändrar inte offentlig kontaktbehörighet.</p>
        </header>

        <form action="/admin/foretag/directory/details" method="get" className="mt-6 flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:flex-row">
          <input name="q" defaultValue={query} maxLength={120} placeholder="Sök namn, organisationsnummer eller slug" aria-label="Sök företag" className="min-h-11 flex-1 rounded-xl border border-[#dfe5dd] px-4 text-sm" />
          <button type="submit" className="min-h-11 rounded-xl bg-[#17452f] px-5 text-sm font-black text-white">Sök</button>
        </form>

        {selected ? (
          <section className="mt-7 space-y-6">
            <div className="rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#607066]">Vald profil</p>
                  <h2 className="mt-2 text-2xl font-black text-[#17201a]">{text(profile.display_name) || text(profile.legal_name) || "Namnlös profil"}</h2>
                  <p className="mt-2 text-sm text-[#68736c]">Org.nr {text(profile.organization_number) || "–"}</p>
                </div>
                {publicSlug ? <Link href={`/foretag/listad/${encodeURIComponent(publicSlug)}`} target="_blank" className="rounded-xl bg-[#17452f] px-4 py-2 text-sm font-black text-white">Öppna publik profil ↗</Link> : null}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Status" value={profile.publication_status} />
                <Field label="Quality" value={`${text(profile.quality_score) || "0"}/100`} />
                <Field label="Legalt namn" value={profile.legal_name} />
                <Field label="Bolagsform" value={profile.legal_form} />
                <Field label="Kategori" value={profile.category_slug} />
                <Field label="Primär SNI" value={[text(profile.primary_sni_code), text(profile.primary_sni_label)].filter(Boolean).join(" · ")} />
                <Field label="Profiladress" value={[text(profile.address_line1), [text(profile.postal_code), text(profile.city)].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
                <Field label="Kommun" value={profile.municipality} />
                <Field label="Webbplats" value={profile.website_url} />
                <Field label="Aktiv" value={Boolean(profile.is_active) ? "Ja" : "Nej"} />
                <Field label="Auto-public eligible" value={Boolean(profile.auto_public_eligible) ? "Ja" : "Nej"} />
                <Field label="Privacy blocked" value={Boolean(profile.privacy_blocked) ? "Ja" : "Nej"} />
                <Field label="Profil senast synkad" value={formatDate(profile.last_synced_at)} />
                <Field label="Profil updated" value={formatDate(profile.updated_at)} />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black text-[#17201a]">SCB Företagsregistret</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${Boolean(selected.scb_snapshot_fresh) ? "bg-[#e7f1eb] text-[#17452f]" : "bg-[#fff4d9] text-[#76580d]"}`}>{Boolean(selected.scb_snapshot_fresh) ? "Fresh" : "Stale / saknas"}</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Field label="Telefon" value={scb.phone} />
                  <Field label="E-post" value={scb.email} />
                  <Field label="Postadress" value={address(scb.postal_address)} />
                  <Field label="Kommun" value={scb.municipality} />
                  <Field label="SNI-koder" value={scb.sni_codes} />
                  <Field label="SCB senast synkad" value={formatDate(scb.last_synced_at)} />
                  <Field label="Arbetsställen" value={workplaces.length} />
                  <Field label="Konflikter" value={selected.scb_conflict_count ?? conflicts.length} />
                </div>
                <div className={`mt-4 rounded-xl p-4 text-sm font-bold ${conflicts.length ? "bg-[#fff4f2] text-[#8a2b20]" : "bg-[#eef8f0] text-[#17452f]"}`}>{conflicts.length ? pretty(conflicts) : "Inga SCB-konflikter."}</div>
              </section>

              <section className="rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black text-[#17201a]">Bolagsverket · Official Facts</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${Boolean(selected.official_facts_fresh) ? "bg-[#e7f1eb] text-[#17452f]" : "bg-[#fff4d9] text-[#76580d]"}`}>{Boolean(selected.official_facts_fresh) ? "Fresh" : "Stale / saknas"}</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Field label="Registrerade namn" value={facts.registered_names} />
                  <Field label="SNI-koder" value={facts.sni_codes} />
                  <Field label="Registreringsdatum" value={facts.registration_date ?? facts.scb_registered_date} />
                  <Field label="Avregistreringsdatum" value={facts.deregistration_date} />
                  <Field label="Reklamspärr" value={facts.advertising_blocked} />
                  <Field label="Pågående processer" value={facts.ongoing_procedures} />
                  <Field label="Official Facts senast synkad" value={formatDate(facts.last_synced_at)} />
                </div>
              </section>
            </div>

            <section className="rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
              <h2 className="text-xl font-black text-[#17201a]">Arbetsställen · {workplaces.length}</h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {workplaces.map((workplace, index) => (
                  <div key={`${text(workplace.cfarNumber)}-${index}`} className="rounded-2xl border border-black/5 bg-[#f7f8f5] p-5">
                    <p className="font-black text-[#253129]">{text(workplace.name) || `Arbetsställe ${index + 1}`}</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Field label="CFAR" value={workplace.cfarNumber} />
                      <Field label="Kommun" value={workplace.municipality} />
                      <Field label="Besöksadress" value={address(workplace.visitingAddress)} />
                      <Field label="Postadress" value={address(workplace.postalAddress)} />
                      <Field label="Telefon" value={workplace.phone} />
                      <Field label="E-post" value={workplace.email} />
                      <Field label="SNI" value={workplace.sniCodes} />
                      <Field label="Koordinater" value={workplace.coordinates} />
                    </div>
                  </div>
                ))}
                {!workplaces.length ? <p className="text-sm text-[#747e77]">Inga SCB-arbetsställen sparade.</p> : null}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <Raw label={`Tjänster · ${services.length}`} value={services} />
              <Raw label={`Geografiska platser · ${locations.length}`} value={locations} />
              <Raw label={`Fältkällor · ${sources.length}`} value={sources} />
            </section>
            <section className="grid gap-4 lg:grid-cols-3">
              <Raw label="Raw profil" value={profile} />
              <Raw label="Raw Official Facts" value={facts} />
              <Raw label="Raw SCB enrichment" value={scb} />
            </section>
          </section>
        ) : profileId ? (
          <div className="mt-6 rounded-2xl bg-[#fff4f2] p-5 text-sm font-bold text-[#8a2b20]">Profilen hittades inte eller profil-ID:t är ogiltigt.</div>
        ) : null}

        <section className="mt-7 overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-black/5">
          <div className="border-b border-black/5 p-5">
            <h2 className="text-xl font-black text-[#17201a]">Företag</h2>
            <p className="mt-1 text-sm text-[#747e77]">Visar högst 50 träffar. Välj en profil för fullständigt adminunderlag.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-[#6b766e]"><tr><th className="px-4 py-3">Företag</th><th className="px-4 py-3">Org.nr</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Quality</th><th className="px-4 py-3">SCB</th><th className="px-4 py-3">Åtgärd</th></tr></thead>
              <tbody className="divide-y divide-black/5">
                {searchRows.map((rawRow) => {
                  const row = rawRow as JsonRecord;
                  const id = text(row.id);
                  return (
                    <tr key={id}>
                      <td className="px-4 py-4"><p className="font-bold text-[#253129]">{text(row.display_name) || text(row.legal_name)}</p><p className="mt-1 text-xs text-[#747e77]">{text(row.city) || "–"} · {text(row.category_slug) || "–"}</p></td>
                      <td className="px-4 py-4 font-mono text-xs">{text(row.organization_number)}</td>
                      <td className="px-4 py-4">{text(row.publication_status)}</td>
                      <td className="px-4 py-4 font-black">{text(row.quality_score) || "0"}/100</td>
                      <td className="px-4 py-4 text-xs">{row.scb_last_synced_at ? `Hämtad ${formatDate(row.scb_last_synced_at)} · ${Number(row.scb_conflict_count) || 0} konflikter` : "Inte hämtad"}</td>
                      <td className="px-4 py-4"><Link href={`/admin/foretag/directory/details?profile=${encodeURIComponent(id)}${query ? `&q=${encodeURIComponent(query)}` : ""}`} className="font-black text-[#17452f] underline underline-offset-4">Visa detaljer</Link></td>
                    </tr>
                  );
                })}
                {!searchRows.length ? <tr><td className="px-4 py-8 text-center text-[#747e77]" colSpan={6}>Inga profiler hittades.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
