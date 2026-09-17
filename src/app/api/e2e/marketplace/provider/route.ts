import { NextResponse } from "next/server";

import {
  isClaimBusinessEmailVerified,
  parseClaimEmailEvidence,
  serializeClaimEmailEvidence,
} from "@/lib/company-directory-claim-email";
import { finalizeCompanyDirectoryClaimIntoExistingWorkspace } from "@/lib/company-directory-existing-workspace-claim";
import { getSql } from "@/lib/db/server";
import {
  isPreviewMarketplaceE2eRuntime,
  previewMarketplaceE2eCoordinates,
  previewMarketplaceE2eOrganizationNumber,
  previewMarketplaceE2eUuid,
  resolveAuthorizedPreviewMarketplaceE2eRunId,
} from "@/lib/preview-marketplace-e2e";

export const dynamic = "force-dynamic";

const TEST_CITY = "Stockholm";
const TEST_POSTAL_CODE = "11100";
const SERVICE_SLUG = "vvs";

function unavailable() {
  return new NextResponse(null, { status: 404 });
}

function ownerEmail(runId: string) {
  return `provider-e2e-${runId}@owner.example.invalid`;
}

function providerSlug(runId: string) {
  return `preview-provider-${runId.slice(0, 20)}`;
}

function providerName(runId: string) {
  return `Preview Provider ${runId.slice(0, 8)} AB`;
}

async function identityFor(runId: string) {
  const profileId = previewMarketplaceE2eUuid("provider-activation", runId);
  const organizationNumber = previewMarketplaceE2eOrganizationNumber(runId);
  const coordinates = previewMarketplaceE2eCoordinates(runId);
  if (!profileId || !organizationNumber || !coordinates) return null;
  return {
    profileId,
    organizationNumber,
    coordinates,
    slug: providerSlug(runId),
    companyName: providerName(runId),
    ownerEmail: ownerEmail(runId),
  };
}

async function currentState(runId: string) {
  const sql = getSql();
  const identity = await identityFor(runId);
  if (!sql || !identity) return null;

  const userRows = await sql`
    select id, name, email
    from "user"
    where lower(email) = ${identity.ownerEmail}
    limit 1
  `;
  const userId = String(userRows[0]?.id ?? "");

  const workspaceRows = userId
    ? await sql`
        select workspace.id::text, workspace.name
        from workspace_memberships membership
        join workspaces workspace on workspace.id = membership.workspace_id
        where membership.user_id = ${userId}
          and membership.role in ('owner', 'admin')
          and workspace.status in ('active', 'trial')
        order by membership.created_at asc, workspace.id asc
        limit 1
      `
    : [];
  const workspaceId = String(workspaceRows[0]?.id ?? "");

  const profileRows = await sql`
    select
      id::text,
      public_slug,
      publication_status,
      claimed_workspace_id::text,
      organization_number
    from company_directory_profiles
    where id = ${identity.profileId}::uuid
    limit 1
  `;
  const profile = profileRows[0];

  const claimRows = userId
    ? await sql`
        select
          id::text,
          status,
          verification_method,
          verification_reference,
          requested_workspace_id::text
        from company_directory_claims
        where profile_id = ${identity.profileId}::uuid
          and claimant_user_id = ${userId}
        order by requested_at desc
        limit 1
      `
    : [];
  const claim = claimRows[0];
  const claimEvidence = parseClaimEmailEvidence(claim?.verification_reference);

  const serviceRows = workspaceId
    ? await sql`
        select
          id::text,
          name,
          public_status,
          conversion_mode,
          coalesce(nullif(trim(primary_directory_service_slug), ''), public_slug) as directory_service_slug
        from workspace_services
        where workspace_id = ${workspaceId}::uuid
          and coalesce(nullif(trim(primary_directory_service_slug), ''), public_slug) = ${SERVICE_SLUG}
        order by updated_at desc, id asc
        limit 1
      `
    : [];
  const service = serviceRows[0];

  const areaRows = await sql`
    select service_slug, radius_km, source_type, public_visible, confirmed_at::text
    from company_directory_service_areas
    where profile_id = ${identity.profileId}::uuid
      and service_slug = ${SERVICE_SLUG}
    order by updated_at desc, id asc
    limit 1
  `;
  const area = areaRows[0];

  return {
    identity,
    user: userId ? { id: userId, email: String(userRows[0]?.email ?? "") } : null,
    workspace: workspaceId ? { id: workspaceId, name: String(workspaceRows[0]?.name ?? "") } : null,
    profile: profile ? {
      id: String(profile.id),
      slug: String(profile.public_slug ?? ""),
      publicationStatus: String(profile.publication_status ?? ""),
      claimedWorkspaceId: String(profile.claimed_workspace_id ?? ""),
      organizationNumber: String(profile.organization_number ?? ""),
    } : null,
    claim: claim ? {
      id: String(claim.id),
      status: String(claim.status ?? ""),
      verificationMethod: String(claim.verification_method ?? ""),
      requestedWorkspaceId: String(claim.requested_workspace_id ?? ""),
      stage: claimEvidence?.stage ?? "",
    } : null,
    service: service ? {
      id: String(service.id),
      name: String(service.name ?? ""),
      publicStatus: String(service.public_status ?? ""),
      conversionMode: String(service.conversion_mode ?? ""),
      directoryServiceSlug: String(service.directory_service_slug ?? ""),
    } : null,
    serviceArea: area ? {
      serviceSlug: String(area.service_slug ?? ""),
      radiusKm: Number(area.radius_km ?? 0),
      sourceType: String(area.source_type ?? ""),
      publicVisible: Boolean(area.public_visible),
      confirmedAt: String(area.confirmed_at ?? ""),
    } : null,
  };
}

export async function POST(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  const runId = await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers);
  if (!runId) return unavailable();
  const sql = getSql();
  const identity = await identityFor(runId);
  if (!sql || !identity) return NextResponse.json({ ok: false, error: "configuration" }, { status: 503 });

  try {
    await sql.transaction((tx) => [
      tx`
        insert into company_directory_profiles (
          id, organization_number, organization_kind, legal_name, display_name,
          is_active, category_slug, city, municipality, address_line1, postal_code,
          public_slug, publication_status, quality_score, privacy_blocked,
          auto_public_eligible, official_source, activity_description, published_at
        ) values (
          ${identity.profileId}::uuid, ${identity.organizationNumber}, 'juridical_person',
          ${identity.companyName}, ${identity.companyName}, true, ${SERVICE_SLUG},
          ${TEST_CITY}, ${TEST_CITY}, 'Preview Providergatan 1', ${TEST_POSTAL_CODE},
          ${identity.slug}, 'published', 100, false, true,
          'preview_e2e', 'Preview E2E synthetic provider activation proof', now()
        )
      `,
      tx`
        insert into company_directory_official_facts (profile_id, advertising_blocked)
        values (${identity.profileId}::uuid, false)
      `,
      tx`
        insert into company_directory_profile_services (
          profile_id, service_slug, source_type, confidence, is_primary,
          is_active, public_visible, confirmed_at
        ) values (
          ${identity.profileId}::uuid, ${SERVICE_SLUG}, 'admin', 100, true,
          true, true, now()
        )
      `,
      tx`
        insert into company_directory_business_locations (
          profile_id, latitude, longitude, geocode_source, geocode_precision,
          geocode_confidence, is_public, geocoded_at
        ) values (
          ${identity.profileId}::uuid, ${identity.coordinates.latitude}, ${identity.coordinates.longitude},
          'lantmateriet_belagenhetsadress_v4_2', 'address', 100, true, now()
        )
      `,
    ]);
  } catch (error) {
    console.error("Preview provider activation E2E fixture setup failed", { error });
    return NextResponse.json({ ok: false, error: "fixture_setup" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...identity });
}

export async function GET(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  const runId = await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers);
  if (!runId) return unavailable();
  const state = await currentState(runId);
  if (!state) return NextResponse.json({ ok: false, error: "state" }, { status: 503 });
  return NextResponse.json({ ok: true, state }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  const runId = await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers);
  if (!runId) return unavailable();
  const sql = getSql();
  const state = await currentState(runId);
  if (!sql || !state?.user || !state.workspace || !state.profile || !state.claim) {
    return NextResponse.json({ ok: false, error: "claim_state" }, { status: 409 });
  }

  const claimRows = await sql`
    select verification_reference
    from company_directory_claims
    where id = ${state.claim.id}::uuid
      and profile_id = ${state.profile.id}::uuid
      and claimant_user_id = ${state.user.id}
      and requested_workspace_id = ${state.workspace.id}::uuid
      and status in ('pending', 'verified')
    limit 1
  `;
  const evidence = parseClaimEmailEvidence(claimRows[0]?.verification_reference);
  if (!isClaimBusinessEmailVerified(evidence) || !evidence) {
    return NextResponse.json({ ok: false, error: "email_not_verified" }, { status: 409 });
  }

  const approvedEvidence = serializeClaimEmailEvidence({
    ...evidence,
    adminReference: "Preview E2E fixture manual-review approval",
    adminReviewedAt: new Date().toISOString(),
  });

  try {
    await finalizeCompanyDirectoryClaimIntoExistingWorkspace({
      claimId: state.claim.id,
      profileId: state.profile.id,
      workspaceId: state.workspace.id,
      claimantUserId: state.user.id,
      adminUserId: state.user.id,
      adminReference: "Preview E2E fixture manual-review approval",
      approvedEvidence,
      activityDescription: "Preview E2E synthetic provider activation proof",
    });
  } catch (error) {
    console.error("Preview provider activation E2E claim finalization failed", { error });
    return NextResponse.json({ ok: false, error: "claim_finalize" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, state: await currentState(runId) });
}

export async function DELETE(request: Request) {
  if (!isPreviewMarketplaceE2eRuntime()) return unavailable();
  const runId = await resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers);
  if (!runId) return unavailable();
  const sql = getSql();
  const identity = await identityFor(runId);
  if (!sql || !identity) return NextResponse.json({ ok: false, error: "configuration" }, { status: 503 });

  try {
    const userRows = await sql`
      select id
      from "user"
      where lower(email) = ${identity.ownerEmail}
      limit 1
    `;
    const userId = String(userRows[0]?.id ?? "");
    const workspaceRows = userId
      ? await sql`
          select workspace_id::text
          from workspace_memberships
          where user_id = ${userId}
          order by created_at asc
          limit 1
        `
      : [];
    const workspaceId = String(workspaceRows[0]?.workspace_id ?? "");

    await sql`delete from company_directory_profiles where id = ${identity.profileId}::uuid`;
    if (workspaceId) await sql`delete from workspaces where id = ${workspaceId}::uuid`;
    if (userId) await sql`delete from "user" where id = ${userId}`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Preview provider activation E2E fixture cleanup failed", { error });
    return NextResponse.json({ ok: false, error: "fixture_cleanup" }, { status: 500 });
  }
}
