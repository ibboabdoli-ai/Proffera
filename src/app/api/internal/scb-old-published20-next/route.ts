import { NextResponse } from "next/server";

import { enrichCompanyDirectoryScbForProfile } from "@/lib/company-directory-scb-enrichment";
import { fetchScbCompanyRegistryEnrichment } from "@/lib/company-directory-scb-provider";
import { getSql } from "@/lib/db/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BATCHES = [
  ["5567795975", "5567750434", "5567771000", "5566608732", "5562306919"],
  ["5562359942", "5562579283", "5562660646", "5563113231", "5563115707"],
  ["5563360071", "5563554392", "5563890887", "5563915312", "5564090230"],
  ["5564103280", "5564208337", "5564212545", "5564255841", "5564414786"],
] as const;

const PROFILE_IDS: Record<string, string> = {
  "5567795975": "629e226f-00de-4e7e-ab28-895c5c3174b4",
  "5567750434": "f0a8fc59-d861-4933-8547-216421e2a2ef",
  "5567771000": "7cbe1a48-9df5-4fc2-9c30-c350f8ac0cbb",
  "5566608732": "71e2fa9a-c450-4a6e-ac75-e803282170d2",
  "5562306919": "28179d1c-eda7-42d4-a403-d278e36a25d6",
  "5562359942": "be6881b3-c028-4c3b-a4f8-a674ca2a8df3",
  "5562579283": "4368a368-5ada-4135-a603-df37591e0dba",
  "5562660646": "8f0e065c-b505-49af-8760-75db8fb04810",
  "5563113231": "588a239f-b9e5-4f19-9b35-b9633e145974",
  "5563115707": "bcfaa512-f813-489f-9870-8adbf87d24ba",
  "5563360071": "fe4df83b-1963-4597-990b-d07b6a7e1bbd",
  "5563554392": "a997f944-10a8-4ea1-b1f5-32f53a9d39d1",
  "5563890887": "a355f558-6b15-4a3a-aa6e-f7f42f1ebdb5",
  "5563915312": "e6dc7f5a-85fc-4269-bd8d-bde84ee29103",
  "5564090230": "7b734541-9b05-42b1-94a4-318c8b3873b5",
  "5564103280": "20ec318b-e2ba-4172-80a9-62fb30bb0cd2",
  "5564208337": "9ca81909-562c-4878-9266-9f373490b298",
  "5564212545": "3ef96a5e-1248-43ef-a19d-e06b1cba5489",
  "5564255841": "a2628c27-e1dc-4d56-8355-fdee0507fe18",
  "5564414786": "d386d889-828f-411d-8abe-2cfac6883c79",
};

const SAVE_CONFIRM = "scb-old-published20-next-20260819";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const headers = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" };

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "preview") {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "lookup";
  const sql = getSql();

  if (mode === "probe") {
    if (!sql) return NextResponse.json({ ok: false, error: "database_unconfigured" }, { status: 503, headers });
    const rows = await sql`
      select
        (select count(*)::int from company_directory_scb_enrichment) as scb_rows,
        (select max(last_synced_at)::text from company_directory_scb_enrichment) as latest_scb_sync,
        (select count(*)::int
         from company_directory_profiles p
         left join company_directory_scb_enrichment s on s.profile_id = p.id
         where p.publication_status = 'published' and s.profile_id is null) as published_without_scb,
        (select publication_status from company_directory_profiles
         where id = 'edae0d98-0748-4143-ae42-f70f3ec7beb0'::uuid) as known_profile_status
    `;
    return NextResponse.json({ ok: true, db: rows[0] ?? null }, { headers });
  }

  const batch = Number(url.searchParams.get("batch") ?? "");
  if (!Number.isInteger(batch) || batch < 1 || batch > BATCHES.length) {
    return NextResponse.json({ ok: false, error: "batch must be 1-4" }, { status: 400, headers });
  }

  if (mode === "save") {
    if (url.searchParams.get("confirm") !== SAVE_CONFIRM) {
      return NextResponse.json({ ok: false, error: "confirmation_required" }, { status: 403, headers });
    }
    if (!sql) return NextResponse.json({ ok: false, error: "database_unconfigured" }, { status: 503, headers });

    const results = [];
    for (const organizationNumber of BATCHES[batch - 1]) {
      const profileId = PROFILE_IDS[organizationNumber];
      const before = await sql`
        select
          p.organization_number, p.publication_status, p.country_code, p.organization_kind,
          p.is_active, p.privacy_blocked, p.auto_public_eligible,
          p.updated_at::text as profile_updated_token,
          f.last_synced_at::text as facts_last_synced_token,
          (f.profile_id is not null and f.last_synced_at >= p.last_synced_at and f.source_payload_hash <> '') as official_facts_fresh,
          f.deregistration_date,
          coalesce(f.advertising_blocked, false) as advertising_blocked,
          jsonb_array_length(coalesce(f.ongoing_procedures, '[]'::jsonb)) as procedures_count,
          exists (select 1 from company_directory_scb_enrichment s where s.profile_id = p.id) as has_scb
        from company_directory_profiles p
        left join company_directory_official_facts f on f.profile_id = p.id
        where p.id = ${profileId}::uuid
        limit 1
      `;
      const row = before[0];
      const eligible = row
        && String(row.organization_number ?? "").replace(/\D/g, "") === organizationNumber
        && row.publication_status === "published"
        && row.country_code === "SE"
        && row.organization_kind === "juridical_person"
        && Boolean(row.is_active)
        && !Boolean(row.privacy_blocked)
        && Boolean(row.auto_public_eligible)
        && Boolean(row.official_facts_fresh)
        && !row.deregistration_date
        && !Boolean(row.advertising_blocked)
        && Number(row.procedures_count ?? 0) === 0
        && !Boolean(row.has_scb);

      if (!eligible) {
        results.push({ organizationNumber, profileId, status: "skipped_preflight" });
        continue;
      }

      try {
        const enriched = await enrichCompanyDirectoryScbForProfile(profileId);
        let publicationAction = "unchanged";
        if (enriched.status === "saved" && enriched.conflicts.length > 0) {
          const moved = await sql`
            update company_directory_profiles p
            set publication_status = 'review', updated_at = now()
            where p.id = ${profileId}::uuid
              and p.publication_status = 'published'
              and p.updated_at::text = ${String(row.profile_updated_token ?? "")}
              and exists (
                select 1 from company_directory_official_facts f
                where f.profile_id = p.id
                  and f.last_synced_at::text = ${String(row.facts_last_synced_token ?? "")}
              )
            returning p.id
          `;
          publicationAction = moved.length ? "moved_to_review" : "conflict_guard_blocked";
        }
        results.push({
          organizationNumber,
          profileId,
          status: enriched.status,
          saved: enriched.saved,
          conflicts: enriched.conflicts,
          publicationAction,
        });
      } catch (error) {
        results.push({
          organizationNumber,
          profileId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      await sleep(2200);
    }
    return NextResponse.json({ ok: true, batch, results }, { headers });
  }

  const results = [];
  for (const organizationNumber of BATCHES[batch - 1]) {
    try {
      const result = await fetchScbCompanyRegistryEnrichment(organizationNumber);
      results.push({ organizationNumber, ok: result.status === "ok", status: result.status, normalized: result.data });
    } catch (error) {
      results.push({
        organizationNumber,
        ok: false,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown SCB error",
      });
    }
    await sleep(2200);
  }

  const configured = results.some((result) => result.status !== "disabled" && result.status !== "awaiting_access");
  return NextResponse.json({ ok: true, configured, batch, results }, { headers });
}
