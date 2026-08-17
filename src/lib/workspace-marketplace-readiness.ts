import "server-only";

import { isValidLeadRecipientEmail } from "@/features/matching/policy";
import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { getWorkspaceEntitlements } from "@/lib/workspace-entitlements";
import {
  resolveMarketplaceReadiness,
  type MarketplaceReadiness,
} from "@/lib/workspace-marketplace-readiness-policy";
import { getDashboardWorkspaceServices } from "@/lib/workspace-services-db";

export type WorkspaceMarketplaceReadiness = MarketplaceReadiness & {
  canManage: boolean;
};

export async function getWorkspaceMarketplaceReadiness(): Promise<WorkspaceMarketplaceReadiness | null> {
  const [access, sql] = await Promise.all([getUserWorkspaceAccess(), Promise.resolve(getSql())]);
  if (!access.ok || !sql) return null;

  try {
    const [services, entitlements, rows] = await Promise.all([
      getDashboardWorkspaceServices(),
      getWorkspaceEntitlements(),
      sql`
        select
          coalesce(nullif(trim(workspace.contact_email), ''), nullif(trim(settings.contact_email), '')) as contact_email,
          exists (
            select 1
            from company_directory_claims claim
            join company_directory_profiles profile on profile.id = claim.profile_id
            where claim.requested_workspace_id = workspace.id
              and claim.status = 'claimed'
              and claim.verified_at is not null
              and claim.resolved_at is not null
              and profile.claimed_workspace_id = workspace.id
              and profile.is_active = true
              and profile.privacy_blocked = false
          ) as claim_verified
        from workspaces workspace
        left join workspace_settings settings on settings.workspace_id = workspace.id::text
        where workspace.id = ${access.workspaceId}::uuid
        limit 1
      `,
    ]);

    const row = rows[0];
    if (!row) return null;

    const readiness = resolveMarketplaceReadiness({
      claimVerified: Boolean(row.claim_verified),
      contactEmailValid: isValidLeadRecipientEmail(String(row.contact_email ?? "")),
      leadManagementAccess: entitlements.some((item) => item.featureKey === "lead_management" && item.hasAccess),
      services: services.map((service) => ({
        isActive: service.isActive,
        publicStatus: service.publicStatus,
        conversionMode: service.conversionMode,
        serviceArea: service.serviceAreaConfirmed && service.serviceAreaRadiusKm !== null ? service.serviceArea : "",
      })),
    });

    return {
      ...readiness,
      canManage: canManageWorkspaceSettings(access),
    };
  } catch (error) {
    console.error("Failed to read workspace marketplace readiness", error);
    return null;
  }
}
