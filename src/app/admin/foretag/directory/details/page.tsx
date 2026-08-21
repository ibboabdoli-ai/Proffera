import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { getSql } from "@/lib/db/server";

export const dynamic = "force-dynamic";

const PROFILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type JsonRecord = Record<string, unknown>;
type PageProps = { searchParams?: Promise<{ q?: string | string[]; profile?: string | string[] }> };

function first(value?: string | string[]) {
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
  try { return JSON.stringify(value ?? null, null, 2); } catch { return String(value ?? ""); }
}

function address(value: unknown) {
  const row = record(value);
  return [
    [text(row.careOf), text(row.addressLine)].filter(Boolean).join(", "),
    [text(row.postalCode), text(row.city)].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ") || "–";
}

function Field({ label, value }: { label: string; value: unknown }) {
  const shown = value === null || value === undefined || value === ""
    ? "–"
    : typeof value === "object" ? pretty(value) : String(value);
  return <div className="rounded-xl bg-[#f7f8f5] p-4"><p className="text-[11px] font-black uppercase tracking-wide text-[#748078]">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm font-bold text-[#243129]">{shown}</p></div>;
}

function Raw({ label, value }: { label: string; value: unknown }) {
  return <details className="rounded-2xl bg-white p-4 ring-1 ring-black/5"><summary className="cursor-pointer font-black text-[#17452f]">{label}</summary><pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-xl bg-[#102a1c] p-4 text-xs text-[#d9f1e0]">{pretty(value)}</pre></details>;
}

export default async function DirectoryAdminDetailsPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const sql = getSql();
  if (!sql) return <main className="p-8">Databasen är inte tillgänglig.</main>;

  const params = await (searchParams ?? Promise.resolve(undefined));
  const query = (first(params?.q) ?? "").trim().slice(0, 120);
  const profileId = (first(params?.profile) ?? "").trim();
  const pattern = `%${query}%`;

  const searchRows = await sql`
    select p.id::text, p.display_name, p.legal_name, p.organization_number,
      p.publication_status, p.quality_score, p.city, p.category_slug,
      scb.last_synced_at as scb_last_synced_at,
      coalesce(jsonb_array_length(scb.conflicts), 0)::int as scb_conflict_count
    from company_directory_profiles p
    left join company_directory_scb_enrichment scb on scb.profile_id = p.id
    where ${query}::text = ''
      or coalesce(p.display_name, '') ilike ${pattern}
      or coalesce(p.legal_name, '') ilike ${pattern}
      or coalesce(p.organization_number, '') ilike ${pattern}
      or coalesce(p.public_slug, '') ilike ${pattern}
    order by case when p.publication_status = 'published' then 0 else 1 end,
      scb.last_synced_at desc nulls last, p.updated_at desc, p.id
    limit 50
  `;

  let selected: JsonRecord | null = null;
  let services: unknown[] = [];
  let locations: unknown[] = [];
  let sources: unknown[] = [];

  if (PROFILE_ID_RE.test(profileId)) {
    const rows = await sql`
      select to_jsonb(p) as profile, to_jsonb(facts) as official_facts, to_jsonb(scb) as scb,
        (facts.profile_id is not null and facts.source_payload_hash <> '' and facts.last_synced_at >= p.last_synced_at) as official_facts_fresh,
        (scb.profile_id is not null and scb.source_payload_hash <> ''
          and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = p.updated_at::text
          and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = facts.last_synced_at::text) as scb_snapshot_fresh,
        coalesce(jsonb_array_length(scb.conflicts), 0)::int as scb_conflict_count
      from company_directory_profiles p
      left join company_directory_official_facts facts on facts.profile_id = p.id
      left join company_directory_scb_enrichment scb on scb.profile_id = p.id
      where p.id = ${profileId}::uuid limit 1
    `;
    selected = rows[0] ? rows[0] as JsonRecord : null;

    if (selected) {
      const [serviceRows, locationRows, sourceRows] = await Promise.all([
        sql`select to_jsonb(service) as value from company_directory_profile_services service where service.profile_id = ${profileId}::uuid order by service.created_at, service.service_slug`,
        sql`select to_jsonb(location) as value from company_directory_business_locations location where location.profile_id = ${profileId}::uuid order by location.created_at`,
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

  return <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8"><section className="mx-auto max-w-7xl">
    <header className="rounded-[1.75rem] bg-[#102a1c] p-7 text-white"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Company Directory · Admin</p><h1 className="mt-2 text-3xl font-black">Fullständigt företagsunderlag</h1><p className="mt-3 text-sm text-white/75">Intern super-adminvy. Detta ändrar inte offentlig kontaktbehörighet.</p></header>

    <form action="/admin/foretag/directory/details" method="get" className="mt-6 flex gap-2 rounded-2xl bg-white p-4 ring-1 ring-black/5"><input name="q" defaultValue={query} maxLength={120} placeholder="Sök namn, organisationsnummer eller slug" className="min-h-11 flex-1 rounded-xl border px-4"/><button className="rounded-xl bg-[#17452f] px-5 font-black text-white">Sök</button></form>

    {selected ? <section className="mt-7 space-y-6">
      <div className="rounded-2xl bg-white p-6 ring-1 ring-black/5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-black">{text(profile.display_name) || text(profile.legal_name)}</h2><p className="mt-1 text-sm text-[#68736c]">Org.nr {text(profile.organization_number)}</p></div>{text(profile.public_slug) ? <Link target="_blank" href={`/foretag/listad/${encodeURIComponent(text(profile.public_slug))}`} className="rounded-xl bg-[#17452f] px-4 py-2 text-sm font-black text-white">Öppna publik profil ↗</Link> : null}</div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Status" value={profile.publication_status}/><Field label="Quality" value={`${text(profile.quality_score) || "0"}/100`}/><Field label="Legalt namn" value={profile.legal_name}/><Field label="SNI" value={[text(profile.primary_sni_code), text(profile.primary_sni_label)].filter(Boolean).join(" · ")}/><Field label="Profiladress" value={[text(profile.address_line1), text(profile.postal_code), text(profile.city)].filter(Boolean).join(", ")}/><Field label="Kommun" value={profile.municipality}/><Field label="Webbplats" value={profile.website_url}/><Field label="Verksamhet" value={profile.activity_description}/></div></div>

      <div className="grid gap-6 xl:grid-cols-2"><div className="rounded-2xl bg-white p-6 ring-1 ring-black/5"><h2 className="text-xl font-black">SCB Företagsregistret · {Boolean(selected.scb_snapshot_fresh) ? "Fresh" : "Stale / saknas"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Telefon" value={scb.phone}/><Field label="E-post" value={scb.email}/><Field label="Postadress" value={address(scb.postal_address)}/><Field label="Kommun" value={scb.municipality}/><Field label="SNI-koder" value={scb.sni_codes}/><Field label="Konflikter" value={selected.scb_conflict_count ?? conflicts.length}/></div></div><div className="rounded-2xl bg-white p-6 ring-1 ring-black/5"><h2 className="text-xl font-black">Official Facts · {Boolean(selected.official_facts_fresh) ? "Fresh" : "Stale / saknas"}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Registrerade namn" value={facts.registered_names}/><Field label="SNI-koder" value={facts.sni_codes}/><Field label="Registreringsdatum" value={facts.registration_date ?? facts.scb_registered_date}/><Field label="Avregistreringsdatum" value={facts.deregistration_date}/><Field label="Reklamspärr" value={facts.advertising_blocked}/><Field label="Pågående processer" value={facts.ongoing_procedures}/></div></div></div>

      <div className="rounded-2xl bg-white p-6 ring-1 ring-black/5"><h2 className="text-xl font-black">Arbetsställen · {workplaces.length}</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">{workplaces.map((workplace, index) => <div key={`${text(workplace.cfarNumber)}-${index}`} className="rounded-xl bg-[#f7f8f5] p-4"><p className="font-black">{text(workplace.name) || `Arbetsställe ${index + 1}`}</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><Field label="CFAR" value={workplace.cfarNumber}/><Field label="Besöksadress" value={address(workplace.visitingAddress)}/><Field label="Postadress" value={address(workplace.postalAddress)}/><Field label="Telefon" value={workplace.phone}/><Field label="E-post" value={workplace.email}/><Field label="SNI" value={workplace.sniCodes}/><Field label="Koordinater" value={workplace.coordinates}/></div></div>)}</div></div>

      <div className="grid gap-4 lg:grid-cols-3"><Raw label={`Tjänster · ${services.length}`} value={services}/><Raw label={`Geografiska platser · ${locations.length}`} value={locations}/><Raw label={`Fältkällor · ${sources.length}`} value={sources}/></div><div className="grid gap-4 lg:grid-cols-3"><Raw label="Raw profil" value={profile}/><Raw label="Raw Official Facts" value={facts}/><Raw label="Raw SCB enrichment" value={scb}/></div>
    </section> : profileId ? <p className="mt-6 rounded-xl bg-[#fff4f2] p-4 font-bold text-[#8a2b20]">Profilen hittades inte.</p> : null}

    <section className="mt-7 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5"><div className="border-b p-5"><h2 className="text-xl font-black">Företag</h2><p className="text-sm text-[#747e77]">Visar högst 50 träffar.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr><th className="p-4">Företag</th><th>Org.nr</th><th>Status</th><th>Quality</th><th>SCB</th><th>Åtgärd</th></tr></thead><tbody>{searchRows.map((raw) => { const row = raw as JsonRecord; const id = text(row.id); return <tr key={id} className="border-t"><td className="p-4 font-bold">{text(row.display_name) || text(row.legal_name)}</td><td>{text(row.organization_number)}</td><td>{text(row.publication_status)}</td><td>{text(row.quality_score)}/100</td><td>{row.scb_last_synced_at ? `Hämtad · ${Number(row.scb_conflict_count) || 0} konflikter` : "Inte hämtad"}</td><td><Link href={`/admin/foretag/directory/details?profile=${encodeURIComponent(id)}${query ? `&q=${encodeURIComponent(query)}` : ""}`} className="font-black text-[#17452f] underline">Visa detaljer</Link></td></tr>; })}</tbody></table></div></section>
  </section></main>;
}
