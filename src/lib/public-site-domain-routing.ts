import "server-only";

import { getSql } from "@/lib/db/server";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";
import {
  hostnameFromHostHeader,
  isPlatformHost,
  isPrimeViewHost,
} from "@/lib/public-site-domains";

export type PublicCustomDomainTarget = {
  workspaceId: string;
  bookingSlug: string;
};

export async function resolvePublicCustomDomain(
  host: string | null | undefined,
): Promise<PublicCustomDomainTarget | null> {
  const hostname = hostnameFromHostHeader(host);
  if (!hostname || isPlatformHost(hostname) || isPrimeViewHost(hostname)) return null;

  const sql = getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      select
        workspace.id::text as workspace_id,
        workspace.public_booking_slug,
        experience.custom_domain_status
      from workspace_experience_settings experience
      join workspaces workspace on workspace.id = experience.workspace_id
      where workspace.status in ('active', 'trial')
        and nullif(trim(workspace.public_booking_slug), '') is not null
        and lower(
          split_part(
            regexp_replace(trim(coalesce(experience.custom_domain, '')), '^https?://', '', 'i'),
            '/',
            1
          )
        ) = ${hostname}
      order by workspace.created_at desc
      limit 2
    `;

    if (rows.length !== 1) return null;

    const workspaceId = String(rows[0]?.workspace_id ?? "");
    const bookingSlug = String(rows[0]?.public_booking_slug ?? "").trim();
    if (!workspaceId || !bookingSlug) return null;

    const [customDomainEnabled, bookingEnabled] = await Promise.all([
      hasWorkspaceFeatureAccessForWorkspace(workspaceId, "custom_domain"),
      hasWorkspaceFeatureAccessForWorkspace(workspaceId, "online_booking"),
    ]);
    if (!customDomainEnabled || !bookingEnabled) return null;

    if (String(rows[0]?.custom_domain_status ?? "") !== "connected") {
      await sql`
        update workspace_experience_settings
        set custom_domain_status = 'connected', updated_at = now()
        where workspace_id = ${workspaceId}::uuid
          and custom_domain_status is distinct from 'connected'
      `;
    }

    return { workspaceId, bookingSlug };
  } catch (error) {
    console.error("Failed to resolve public custom domain", error);
    return null;
  }
}
