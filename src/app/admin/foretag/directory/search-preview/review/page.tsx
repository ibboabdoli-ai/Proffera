import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { DIRECTORY_GEOCODING_PILOT_ORGS } from "@/lib/company-directory-geocoding";
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

/** Shows terminal Lantmäteriet v2 pilot failures without mutating Production data. */
export default async function DirectoryGeocodingReviewPage() {
  await requireSuperAdmin();
  const sql = getSql();
  const orgsJson = JSON.stringify(DIRECTORY_GEOCODING_PILOT_ORGS);

  const rows = sql
    ? await sql`
        select
          profile.display_name,
          profile.organization_number,
          location.geocode_source,
          location.geocoded_at
        from company_directory_profiles profile
        join company_directory_business_locations location
          on location.profile_id = profile.id
        where profile.organization_number in (
          select jsonb_array_elements_text(${orgsJson}::jsonb)
        )
          and (location.latitude is null or location.longitude is null)
          and location.geocode_source like 'lantmateriet_no_match_v4_2:registerenhet_v2:%'
        order by profile.display_name
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
            Visar endast terminala registerenhet-v2-resultat utan verifierade koordinater. Sidan är read-only och ändrar inga företagsdata.
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
              {reviewRows.length} terminala v2-resultat
            </p>
          </div>

          {reviewRows.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#657068] sm:px-6">
              Inga terminala v2-resultat finns just nu.
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
