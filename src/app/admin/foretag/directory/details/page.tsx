import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { getSql } from "@/lib/db/server";

export const dynamic = "force-dynamic";

const PROFILE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PageProps = {
  searchParams?: Promise<{
    q?: string | string[];
    profile?: string | string[];
  }>;
};

type JsonRecord = Record<string, unknown>;

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function compactJson(value: unknown) {
  if (value === null || value === undefined) return "–";
  if (typeof value === "string") return value || "–";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "–";
  }
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function formatDate(value: unknown) {
  const raw = text(value);
  if (!raw) return "–";
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Europe/Stockholm",
  }).format(parsed);
}

function formatAddress(value: unknown) {
  const address = record(value);
  const first = [text(address.careOf), text(address.addressLine)].filter(Boolean).join(", ");
  const second = [text(address.postalCode), text(address.city)].filter(Boolean).join(" ");
  return [first, second].filter(Boolean).join(", ") || "–";
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-black/5 bg-[#f7f8f5] p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#748078]">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-[#243129]">{compactJson(value)}</p>
    </div>
  );
}

function RawJson({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded-2xl border border-black/5 bg-white p-4">
      <summary className="cursor-pointer text-sm font-black text-[#17452f]">{title}</summary>
      <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#102a1c] p-4 text-xs leading-5 text-[#d9f1e0]">
        {prettyJson(value)}
      </pre>
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
    return (
      <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-[#e0c987] bg-[#fff9e8] p-6 text-[#665019]">
          Databasen är inte tillgänglig i den här miljön.
        </div>
      </main>
    );
  }

  const queryPattern = `%${query}%`;
  const searchRows = await sql`
    select
      p.id::text,
      p.display_name,
      p.legal_name,
      p.organization_number,
      p.publication_status,
      p.quality_score,
      p.city,
      p.category_slug,
      p.public_slug,
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
  let serviceRows: unknown[] = [];
  let locationRows: unknown[] = [];
  let fieldSourceRows: unknown[] = [];

  if (PROFILE_ID_RE.test(profileId)) {
    const selectedRows = await sql`
      select
        p.id::text,
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

    if (selectedRows[0]) {
      selected = selectedRows[0] as JsonRecord;
      const [services, locations, fieldSources] = await Promise.all([
        sql`
          select to_jsonb(service) as value
          from company_directory_profile_services service
          where service.profile_id = ${profileId}::uuid
          order by service.created_at, service.id
        `,
        sql`
          select to_jsonb(location) as value
          from company_directory_business_locations location
          where location.profile_id = ${profileId}::uuid
          order by location.created_at, location.id
        `,
        sql`
          select to_jsonb(source) as value
          from company_directory_field_sources source
          where source.profile_id = ${profileId}::uuid
          order by source.observed_at desc nulls last, source.created_at desc, source.id
          limit 100
        `,
      ]);
      serviceRows = services.map((row) => (row as JsonRecord).value);
      locationRows = locations.map((row) => (row as JsonRecord).value);
      fieldSourceRows = fieldSources.map((row) => (row as JsonRecord).value);
    }
  }

  const profile = record(selected?.profile);
  const facts = record(selected?.official_facts);
  const scb = record(selected?.scb);
  const workplaces = array(scb.workplaces).map(record);
  const conflicts = array(scb.conflicts);
  const profilePublicSlug = text(profile.public_slug);

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[1.75rem] bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10 sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Company Directory · Admin</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Fullständigt företagsunderlag</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Super-adminvy för profil, Official Facts, SCB, arbetsställen, adresser, kontaktdata, källor och freshness. Ingenting här låser upp kontaktdata publikt.
          </p>
        </div>

        <form action="/admin/foretag/directory/details" method="get" className="mt-6 flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-black/5 sm:flex-row">
          <input
            name="q"
            defaultValue={query}
            maxLength={120}
            placeholder="Sök namn, organisationsnummer eller slug"
            aria-label="Sök företag"
            className="min-h-11 flex-1 rounded-xl border border-[#dfe5dd] px-4 text-sm outline-none focus:border-[#17452f]"
          />
          <button type="submit" className="min-h-11 rounded-xl bg-[#17452f] px-5 text-sm font-black text-white hover:bg-[#123724]">Sök</button>
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
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#e8f0ff] px-3 py-1 text-xs font-black text-[#34508b]">{text(profile.publication_status) || "–"}</span>
                  <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-black text-[#17452f]">Quality {text(profile.quality_score) || "0"}/100</span>
                  {profilePublicSlug ? <Link href={`/foretag/listad/${encodeURIComponent(profilePublicSlug)}`} target="_blank" className="rounded-full bg-[#17452f] px-3 py-1 text-xs font-black text-white">Öppna publik profil ↗</Link> : null}
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Legalt namn" value={profile.legal_name} />
                <Field label="Bolagsform" value={profile.legal_form} />
                <Field label="Kategori" value={profile.category_slug} />
                <Field label="Primär SNI" value={[text(profile.primary_sni_code), text(profile.primary_sni_label)].filter(Boolean).join(" · ")} />
                <Field label="Profiladress" value={[text(profile.address_line1), [text(profile.postal_code), text(profile.city)].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
                <Field label="Kommun" value={profile.municipality} />
                <Field label="Webbplats" value={profile.website_url} />
                <Field label="Aktiv / auto-public" value={`${Boolean(profile.is_active) ? "Ja" : "Nej"} / ${Boolean(profile.auto_public_eligible) ? "Ja" : "Nej"}`} />
                <Field label="Privacy blocked" value={Boolean(profile.privacy_blocked) ? "Ja" : "Nej"} />
                <Field label="Claimed workspace" value={profile.claimed_workspace_id} />
                <Field label="Profil senast synkad" value={formatDate(profile.last_synced_at)} />
                <Field label="Profil updated" value={formatDate(profile.updated_at)} />
              </div>

              {text(profile.activity_description) ? (
                <div className="mt-5 rounded-2xl bg-[#f7f8f5] p-5">
                  <p className="text-xs font-black uppercase tracking-wide text-[#607066]">Verksamhetsbeskrivning</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#344039]">{text(profile.activity_description)}</p>
                </div>
              ) : null}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#607066]">SCB Företagsregistret</p>
                    <h2 className="mt-2 text-xl font-black text-[#17201a]">Kontakt och arbetsställen</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${Boolean(selected.scb_snapshot_fresh) ? "bg-[#e7f1eb] text-[#17452f]" : "bg-[#fff4d9] text-[#76580d]"}`}>
                    {Boolean(selected.scb_snapshot_fresh) ? "Fresh" : "Stale / saknas"}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Field label="Telefon" value={scb.phone} />
                  <Field label="E-post" value={scb.email} />
                  <Field label="Postadress" value={formatAddress(scb.postal_address)} />
                  <Field label="Kommun" value={scb.municipality} />
                  <Field label="SNI-koder" value={scb.sni_codes} />
                  <Field label="SCB senast synkad" value={formatDate(scb.last_synced_at)} />
                  <Field label="Arbetsställen" value={workplaces.length} />
                  <Field label="Konflikter" value={selected.scb_conflict_count ?? conflicts.length} />
                </div>
                {conflicts.length ? (
                  <div className="mt-4 rounded-xl border border-[#efc0b9] bg-[#fff4f2] p-4 text-sm text-[#8a2b20]">
                    <p className="font-black">SCB-konflikter</p>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs">{prettyJson(conflicts)}</pre>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-[#b8d9c2] bg-[#eef8f0] p-4 text-sm font-bold text-[#17452f]">Inga SCB-konflikter.</div>
                )}
              </section>

              <section className="rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-[#607066]">Bolagsverket</p>
                    <h2 className="mt-2 text-xl font-black text-[#17201a]">Official Facts</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${Boolean(selected.official_facts_fresh) ? "bg-[#e7f1eb] text-[#17452f]" : "bg-[#fff4d9] text-[#76580d]"}`}>
                    {Boolean(selected.official_facts_fresh) ? "Fresh" : "Stale / saknas"}
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Field label="Registrerade namn" value={facts.registered_names} />
                  <Field label="SNI-koder" value={facts.sni_codes} />
                  <Field label="Registreringsdatum" value={facts.registration_date ?? facts.scb_registered_date} />
                  <Field label="Avregistreringsdatum" value={facts.deregistration_date} />
                  <Field label="Avregistreringsorsak" value={facts.deregistration_reason} />
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
                      <Field label="Besöksadress" value={formatAddress(workplace.visitingAddress)} />
                      <Field label="Postadress" value={formatAddress(workplace.postalAddress)} />
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
              <RawJson title={`Tjänster · ${serviceRows.length}`} value={serviceRows} />
              <RawJson title={`Geografiska platser · ${locationRows.length}`} value={locationRows} />
              <RawJson title={`Fältkällor · ${fieldSourceRows.length}`} value={fieldSourceRows} />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <RawJson title="Raw profil" value={profile} />
              <RawJson title="Raw Official Facts" value={facts} />
              <RawJson title="Raw SCB enrichment" value={scb} />
            </section>
          </section>
        ) : profileId ? (
          <div className="mt-6 rounded-2xl border border-[#e7b8b1] bg-[#fff4f2] p-5 text-sm font-semibold text-[#8a2b20]">
            Profilen hittades inte eller profil-ID:t är ogiltigt.
          </div>
        ) : null}

        <section className="mt-7 overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-black/5">
          <div className="border-b border-black/5 p-5">
            <h2 className="text-xl font-black text-[#17201a]">Företag</h2>
            <p className="mt-1 text-sm text-[#747e77]">Visar högst 50 träffar. Välj en profil för fullständigt adminunderlag.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-[#6b766e]">
                <tr>
                  <th className="px-4 py-3">Företag</th>
                  <th className="px-4 py-3">Org.nr</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Quality</th>
                  <th className="px-4 py-3">SCB</th>
                  <th className="px-4 py-3">Åtgärd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {searchRows.map((row) => {
                  const item = row as JsonRecord;
                  const id = text(item.id);
                  return (
                    <tr key={id}>
                      <td className="px-4 py-4">
                        <p className="font-bold text-[#253129]">{text(item.display_name) || text(item.legal_name)}</p>
                        <p className="mt-1 text-xs text-[#747e77]">{text(item.city) || "–"} · {text(item.category_slug) || "–"}</p>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs">{text(item.organization_number)}</td>
                      <td className="px-4 py-4">{text(item.publication_status)}</td>
                      <td className="px-4 py-4 font-black">{text(item.quality_score) || "0"}/100</td>
                      <td className="px-4 py-4 text-xs text-[#5f6a62]">
                        {item.scb_last_synced_at ? <><p>Hämtad {formatDate(item.scb_last_synced_at)}</p><p>{Number(item.scb_conflict_count) || 0} konflikter</p></> : "Inte hämtad"}
                      </td>
                      <td className="px-4 py-4">
                        <Link href={`/admin/foretag/directory/details?profile=${encodeURIComponent(id)}${query ? `&q=${encodeURIComponent(query)}` : ""}`} className="font-black text-[#17452f] underline underline-offset-4">Visa detaljer</Link>
                      </td>
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
