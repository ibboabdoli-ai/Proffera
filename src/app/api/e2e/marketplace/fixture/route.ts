import { NextResponse } from "next/server";

import { resolveDatabaseUrl } from "@/lib/db/database-url";
import { getSql } from "@/lib/db/server";
import { resolveBrevoApiKey, resolvePreviewEmailRecipient } from "@/lib/email-runtime-config";
import { processMarketplaceAutoWorker } from "@/lib/marketplace-auto-worker";
import {
  isPreviewMarketplaceE2eRuntime,
  previewMarketplaceE2eCoordinates,
  previewMarketplaceE2eCustomerEmail,
  previewMarketplaceE2eOrganizationNumber,
  previewMarketplaceE2eProviderEmail,
  previewMarketplaceE2eProviderSlug,
  previewMarketplaceE2eUuid,
  resolveAuthorizedPreviewMarketplaceE2eRunId,
} from "@/lib/preview-marketplace-e2e";

export const dynamic = "force-dynamic";

// The published synthetic Directory profile satisfies the existing Stockholm
// pilot-location contract. Each E2E suite receives a deterministic coordinate
// cell well outside Sweden, separated by more than the 50 km matching radius
// from adjacent cells so stale synthetic providers from other runs cannot match.
const TEST_CITY = "Stockholm";
const TEST_MUNICIPALITY = "Stockholm";
const TEST_POSTAL_CODE = "11100";

function unavailable() {
  return new NextResponse(null, { status: 404 });
}

function parseRunIds(value: string | null) {
  const values = String(value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(values)]
    .filter((runId) => Boolean(previewMarketplaceE2eCustomerEmail(runId)))
    .slice(0, 4);
}

function parseBodyRunIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim().toLowerCase()))]
    .filter((runId) => Boolean(previewMarketplaceE2eCustomerEmail(runId)))
    .slice(0, 4);
}

async function deleteCustomerRun(runId: string) {
  const sql = getSql();
  const email = previewMarketplaceE2eCustomerEmail(runId);
  if (!sql || !email) return;

  const quoteRows = await sql`
    select id::text
    from quote_requests
    where lower(btrim(contact_email)) = ${email}
  `;
  for (const row of quoteRows) {
    await sql`delete from quote_requests where id = ${String(row.id)}::uuid`;
  }
}

async function customerState(runId: string) {
  const sql = getSql();
  const email = previewMarketplaceE2eCustomerEmail(runId);
  if (!sql || !email) return null;

  const rows = await sql`
    select
      request.id::text as quote_request_id,
      request.reference_id,
      request.status as quote_status,
      (select count(*)::int from marketplace_quote_invitations invitation where invitation.quote_request_id = request.id) as invitation_count,
      (select count(*)::int from marketplace_quote_offers offer where offer.quote_request_id = request.id) as offer_count,
      (select count(*)::int from marketplace_quote_offers offer where offer.quote_request_id = request.id and offer.status = 'selected') as selected_offer_count,
      (select count(*)::int from marketplace_service_jobs job where job.quote_request_id = request.id) as job_count,
      (select count(*)::int from marketplace_service_jobs job where job.quote_request_id = request.id and job.status = 'completed') as completed_job_count,
      (
        select count(*)::int
        from website_review_invitations invitation
        join marketplace_service_jobs job on job.id = invitation.marketplace_service_job_id
        where job.quote_request_id = request.id
      ) as review_invitation_count,
      (
        select count(*)::int
        from website_reviews review
        join marketplace_service_jobs job on job.id = review.marketplace_service_job_id
        where job.quote_request_id = request.id
      ) as review_count,
      (
        select coalesce(max(review.status), '')
        from website_reviews review
        join marketplace_service_jobs job on job.id = review.marketplace_service_job_id
        where job.quote_request_id = request.id
      ) as review_status
    from quote_requests request
    where lower(btrim(request.contact_email)) = ${email}
    order by request.created_at desc
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    quoteRequestId: String(row.quote_request_id),
    referenceId: String(row.reference_id),
    quoteStatus: String(row.quote_status),
    invitationCount: Number(row.invitation_count ?? 0),
    offerCount: Number(row.offer_count ?? 0),
    selectedOfferCount: Number(row.selected_offer_count ?? 0),
    jobCount: Number(row.job_count ?? 0),
    completedJobCount: Number(row.completed_job_count ?? 0),
    reviewInvitationCount: Number(row.review_invitation_count ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    reviewStatus: String(row.review_status ?? ""),
  };
}

async function providerExists(suiteRunId: string) {
  const sql = getSql();
  const profileId = previewMarketplaceE2eUuid("provider", suiteRunId);
  if (!sql || !profileId) return false;
  const rows = await sql`
    select exists(
      select 1 from company_directory_profiles where id = ${profileId}::uuid
    ) as exists
  `;
  return rows[0]?.exists === true;
}

async function quoteReferencesForRuns(runIds: string[]) {
  const sql = getSql();
  if (!sql) return [] as string[];
  const references: string[] = [];
  for (const runId of runIds) {
    const email = previewMarketplaceE2eCustomerEmail(runId);
    if (!email) continue;
    const rows = await sql`
      select reference_id
      from quote_requests
      where lower(btrim(contact_email)) = ${email}
      order by created_at desc
      limit 1
    `;
    const referenceId = String(rows[0]?.reference_id ?? "").trim();
    if (referenceId) references.push(referenceId);
  }
  return references;
}

export async function POST(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  const suiteRunId = await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers);
  if (!suiteRunId) return unavailable();
  const databaseUrl = resolveDatabaseUrl();
  if (!databaseUrl) return NextResponse.json({ ok: false, error: "database" }, { status: 503 });
  const sql = getSql();
  if (!sql) return NextResponse.json({ ok: false, error: "database" }, { status: 503 });

  const profileId = previewMarketplaceE2eUuid("provider", suiteRunId);
  const serviceAreaId = previewMarketplaceE2eUuid("service-area", suiteRunId);
  const slug = previewMarketplaceE2eProviderSlug(suiteRunId);
  const providerEmail = previewMarketplaceE2eProviderEmail(suiteRunId);
  const organizationNumber = previewMarketplaceE2eOrganizationNumber(suiteRunId);
  const coordinates = previewMarketplaceE2eCoordinates(suiteRunId);
  if (!profileId || !serviceAreaId || !slug || !providerEmail || !organizationNumber || !coordinates) return unavailable();

  const companyName = `Preview E2E Rör ${suiteRunId.slice(0, 8)} AB`;
  const workplaces = JSON.stringify([{
    cfarNumber: `E2E-${suiteRunId.slice(0, 12)}`,
    municipality: TEST_MUNICIPALITY,
    visitingAddress: {
      addressLine: "Preview Testgatan 1",
      postalCode: TEST_POSTAL_CODE,
      city: TEST_CITY,
    },
  }]);

  try {
    await sql.transaction((tx) => [
      tx`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          is_active, category_slug, city, municipality, public_slug,
          publication_status, quality_score, privacy_blocked, auto_public_eligible, published_at
        ) values (
          ${profileId}::uuid, ${organizationNumber}, 'juridical_person', ${companyName}, ${companyName},
          true, 'vvs', ${TEST_CITY}, ${TEST_MUNICIPALITY}, ${slug},
          'published', 100, false, true, now()
        )
      `,
      tx`
        insert into company_directory_official_facts (profile_id, advertising_blocked)
        values (${profileId}::uuid, false)
      `,
      tx`
        insert into company_directory_profile_services (
          profile_id, service_slug, source_type, confidence, is_primary, is_active, public_visible, confirmed_at
        ) values (${profileId}::uuid, 'vvs', 'admin', 100, true, true, true, now())
      `,
      tx`
        insert into company_directory_business_locations (
          profile_id, latitude, longitude, geocode_source, geocode_precision,
          geocode_confidence, is_public, geocoded_at
        ) values (
          ${profileId}::uuid, ${coordinates.latitude}, ${coordinates.longitude},
          'lantmateriet_belagenhetsadress_v4_2', 'address', 100, true, now()
        )
      `,
      tx`
        insert into company_directory_scb_enrichment (
          profile_id, organization_number, observed_company_name, email,
          workplaces, conflicts, provenance, source_payload_hash, last_synced_at
        ) values (
          ${profileId}::uuid, ${organizationNumber}, ${companyName}, ${providerEmail},
          ${workplaces}::jsonb, '[]'::jsonb, '{"source":"preview_e2e"}'::jsonb,
          ${`preview-e2e-${suiteRunId}`}, now()
        )
      `,
      tx`
        insert into company_directory_service_areas (
          id, profile_id, service_slug, radius_km, source_type,
          confidence, public_visible, confirmed_at
        ) values (
          ${serviceAreaId}::uuid, ${profileId}::uuid, 'vvs', 25, 'admin', 100, true, now()
        )
      `,
    ]);
  } catch (error) {
    console.error("Preview Marketplace E2E fixture setup failed", { error });
    return NextResponse.json({ ok: false, error: "fixture_setup" }, { status: 500 });
  }

  const previewRecipient = resolvePreviewEmailRecipient();
  return NextResponse.json({
    ok: true,
    provider: { profileId, slug, companyName },
    location: {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      city: TEST_CITY,
      municipality: TEST_MUNICIPALITY,
      postalCode: TEST_POSTAL_CODE,
    },
    isolation: {
      previewRuntime: true,
      databaseIsolated: Boolean(databaseUrl),
      previewEmailConfigured: Boolean(resolveBrevoApiKey() && previewRecipient),
      controlledRecipientConfigured: Boolean(previewRecipient),
    },
  });
}

export async function PUT(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  const suiteRunId = await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers);
  if (!suiteRunId) return unavailable();

  let body: { runIds?: unknown } = {};
  try {
    body = await request.json() as { runIds?: unknown };
  } catch {
    body = {};
  }
  const runIds = parseBodyRunIds(body.runIds);
  if (runIds.length === 0) return NextResponse.json({ ok: false, error: "run_ids" }, { status: 400 });

  const targetReferenceIds = await quoteReferencesForRuns(runIds);
  if (targetReferenceIds.length !== runIds.length) {
    return NextResponse.json({ ok: false, error: "quote_missing" }, { status: 409 });
  }

  const result = await processMarketplaceAutoWorker({
    baseUrl: new URL(request.url).origin,
    targetReferenceIds,
    batchSize: runIds.length,
    actorId: `system:preview-marketplace-e2e:${suiteRunId}`,
  });
  return NextResponse.json({ ok: result.ok, result });
}

export async function GET(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  const suiteRunId = await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers);
  if (!suiteRunId) return unavailable();
  const url = new URL(request.url);
  const runIds = parseRunIds(url.searchParams.get("runs"));
  const states = [];
  for (const runId of runIds) states.push({ runId, state: await customerState(runId) });
  return NextResponse.json({ ok: true, providerExists: await providerExists(suiteRunId), states });
}

export async function DELETE(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  const suiteRunId = await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers);
  if (!suiteRunId) return unavailable();
  const sql = getSql();
  if (!sql) return NextResponse.json({ ok: false, error: "database" }, { status: 503 });

  let body: { runIds?: unknown; deleteProvider?: unknown } = {};
  try {
    body = await request.json() as { runIds?: unknown; deleteProvider?: unknown };
  } catch {
    body = {};
  }
  const runIds = parseBodyRunIds(body.runIds);
  const deleteProvider = body.deleteProvider !== false;

  try {
    for (const runId of runIds) await deleteCustomerRun(runId);
    if (deleteProvider) {
      const profileId = previewMarketplaceE2eUuid("provider", suiteRunId);
      if (profileId) await sql`delete from company_directory_profiles where id = ${profileId}::uuid`;
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Preview Marketplace E2E fixture cleanup failed", { error });
    return NextResponse.json({ ok: false, error: "fixture_cleanup" }, { status: 500 });
  }
}
