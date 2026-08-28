import "server-only";

import { getSql } from "@/lib/db/server";
import { getPlatformAdmin } from "@/lib/platform-admin";

/** List only privacy-safe fields needed to review pending sole-trader claims. */
export async function listPendingSoleTraderDirectoryClaims(limit = 100) {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
  const sql = getSql();
  if (!sql) return { admin, rows: [] };
  const safeLimit = Math.max(1, Math.min(250, Math.floor(limit)));

  const rows = await sql`
    select
      claim.id::text,
      claim.status,
      claim.requested_at,
      claim.requested_workspace_id::text,
      profile.id::text as profile_id,
      profile.public_slug,
      profile.display_name,
      profile.legal_form,
      profile.organization_status,
      profile.city,
      profile.primary_sni_code,
      profile.primary_sni_label,
      profile.category_slug,
      profile.activity_description,
      profile.official_source,
      profile.quality_score,
      workspace.name as workspace_name,
      workspace.company_name as workspace_company_name,
      claimant.name as claimant_name,
      claimant.email as claimant_email
    from company_directory_claims claim
    join company_directory_profiles profile on profile.id = claim.profile_id
    join workspaces workspace on workspace.id = claim.requested_workspace_id
    join "user" claimant on claimant.id = claim.claimant_user_id
    where claim.status in ('pending', 'verified')
      and claim.verification_method = 'manual_review'
      and profile.organization_kind = 'sole_trader'
      and profile.official_source = 'bolagsverket_vardefulla_datamangder:sole_trader_owner'
      and profile.claimed_workspace_id is null
    order by claim.requested_at asc
    limit ${safeLimit}
  `;

  return { admin, rows };
}
