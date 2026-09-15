import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { getSql } from "@/lib/db/server";

export const dynamic = "force-dynamic";

type ReviewRow = {
  display_name: string | null;
  organization_number: string;
  geocode_source: string;
  geocoded_at: string | Date | null;
};

function geocodeReason(source: string) {
  return source.split(":").at(-1) || source;
}

/** Shows provider no-match states that cannot continue automatically, without mutating Production data. */
export default async function DirectoryGeocodingReviewPage() {
  await requireSuperAdmin();
  const sql = getSql();

  const rows = sql
    ? await sql`
        with review_state as (
          select
            profile.id,
            profile.display_name,
            profile.organization_number,
            location.geocode_source,
            location.geocoded_at,
            case
              when jsonb_typeof(scb.workplaces) is distinct from 'array' then false
              when jsonb_array_length(scb.workplaces) <> 1 then false
              when jsonb_typeof(scb.workplaces -> 0) is distinct from 'object' then false
              when jsonb_typeof(scb.workplaces -> 0 -> 'visitingAddress') is distinct from 'object' then false
              when coalesce(jsonb_typeof(scb.workplaces -> 0 -> 'visitingAddress' -> 'addressLine'), '') not in ('string', 'number', 'boolean') then false
              when coalesce(jsonb_typeof(scb.workplaces -> 0 -> 'visitingAddress' -> 'postalCode'), '') not in ('string', 'number', 'boolean') then false
              when coalesce(jsonb_typeof(scb.workplaces -> 0 -> 'visitingAddress' -> 'city'), '') not in ('string', 'number', 'boolean') then false
              when coalesce(jsonb_typeof(scb.workplaces -> 0 -> 'municipality'), '') not in ('string', 'number', 'boolean') then false
              when nullif(btrim(scb.workplaces -> 0 -> 'visitingAddress' ->> 'addressLine'), '') is null then false
              when nullif(btrim(scb.workplaces -> 0 -> 'visitingAddress' ->> 'postalCode'), '') is null then false
              when nullif(btrim(scb.workplaces -> 0 -> 'visitingAddress' ->> 'city'), '') is null then false
              when nullif(btrim(scb.workplaces -> 0 ->> 'municipality'), '') is null then false
              when scb.conflicts is null then true
              when jsonb_typeof(scb.conflicts) is distinct from 'array' then false
              else jsonb_array_length(scb.conflicts) = 0
            end as has_safe_workplace
          from company_directory_profiles profile
          join company_directory_business_locations location
            on location.profile_id = profile.id
          left join company_directory_scb_enrichment scb
            on scb.profile_id = profile.id
          where profile.publication_status = 'published'
            and profile.is_active = true
            and profile.privacy_blocked = false
            and profile.organization_kind = 'juridical_person'
            and exists (
              select 1
              from company_directory_profile_services relation
              where relation.profile_id = profile.id
                and relation.is_active = true
                and relation.public_visible = true
            )
            and (location.latitude is null or location.longitude is null)
        )
        select
          display_name,
          organization_number,
          geocode_source,
          geocoded_at
        from review_state
        where (
          geocode_source = 'lantmateriet_no_match_v4_2'
          or geocode_source like 'lantmateriet_no_match_v4_2:%'
        )
          and not (
            has_safe_workplace
            and geocode_source not like 'lantmateriet_no_match_v4_2:registerenhet_v2:scb_workplace:%'
          )
        order by display_name, id
      `
    : [];

  const reviewRows = rows as ReviewRow[];

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl">
        <div className="rounded-[1.75rem] bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10 sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">
            Företagsdirectory · Diagnostik
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Adresser som behöver granskas</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Visar no-match-resultat som inte kan fortsätta automatiskt för publicerade leverantörer utan verifierade koordinater. Sidan är read-only och ändrar inga företagsdata.
          </p>
          <Link
            href="/admin/foretag/directory/search-preview"
            className="mt-5 inline-block text-sm font-bold text-[#d6eadd] underline underline-offset-4"
          >
            Tillbaka till Plats & sökning
          </Link>
        </div>

        <div className="mt-7 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          <div className="border-b border-black/5 px-5 py-4 sm:px-6">
            <p className="text-sm font-black text-[#17201a]">
              {reviewRows.length} resultat som behöver granskas
            </p>
          </div>

          {reviewRows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#657068] sm:px-6">
              Inga no-match-resultat behöver granskas just nu.
            </p>
          ) : (
            <div className="divide-y divide-black/5">
              {reviewRows.map((row) => (
                <article key={row.organization_number} className="px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="text-base font-black text-[#17201a]">
                        {row.display_name || row.organization_number}
                      </h2>
                      <p className="mt-1 text-sm text-[#657068]">Org.nr {row.organization_number}</p>
                    </div>
                    <span className="w-fit rounded-full bg-[#fff4d9] px-3 py-1 text-xs font-black text-[#76580d]">
                      {geocodeReason(row.geocode_source)}
                    </span>
                  </div>
                  <details className="mt-4 rounded-xl bg-[#fafaf8] px-4 py-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-[#607066]">
                      Teknisk källa
                    </summary>
                    <code className="mt-2 block break-all text-xs text-[#465149]">
                      {row.geocode_source}
                    </code>
                  </details>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
