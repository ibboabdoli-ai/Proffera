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
  workspaceSlug: string;
  bookingSlug: string;
  publicHomeMode: "booking" | "website";
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
        workspace.slug as workspace_slug,
        coalesce(workspace.public_booking_slug, '') as public_booking_slug,
        coalesce(experience.public_home_mode, 'booking') as public_home_mode,
        experience.custom_domain_status
      from workspace_experience_settings experience
      join workspaces workspace on workspace.id = experience.workspace_id
      where workspace.status in ('active', 'trial')
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
    const workspaceSlug = String(rows[0]?.workspace_slug ?? "").trim();
    const bookingSlug = String(rows[0]?.public_booking_slug ?? "").trim();
    const publicHomeMode = rows[0]?.public_home_mode === "website" ? "website" as const : "booking" as const;
    if (!workspaceId || !workspaceSlug || (publicHomeMode === "booking" && !bookingSlug)) return null;

    const [customDomainEnabled, destinationEnabled] = await Promise.all([
      hasWorkspaceFeatureAccessForWorkspace(workspaceId, "custom_domain"),
      hasWorkspaceFeatureAccessForWorkspace(workspaceId, publicHomeMode === "website" ? "website_builder" : "online_booking"),
    ]);
    if (!customDomainEnabled || !destinationEnabled) return null;

    if (String(rows[0]?.custom_domain_status ?? "") !== "connected") {
      await sql`
        update workspace_experience_settings
        set custom_domain_status = 'connected', updated_at = now()
        where workspace_id = ${workspaceId}::uuid
          and custom_domain_status is distinct from 'connected'
      `;
    }

    return { workspaceId, workspaceSlug, bookingSlug, publicHomeMode };
  } catch (error) {
    console.error("Failed to resolve public custom domain", error);
    return null;
  }
}
