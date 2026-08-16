import "server-only";

import { getSql } from "@/lib/db/server";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

export async function getClaimedDirectoryWorkspaceSlug(directorySlug: string) {
  const slug = directorySlug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    select workspace.id::text as workspace_id, workspace.slug
    from company_directory_profiles profile
    join workspaces workspace on workspace.id = profile.claimed_workspace_id
    where profile.public_slug = ${slug}
      and profile.publication_status = 'claimed'
      and profile.claimed_workspace_id is not null
      and workspace.status in ('active', 'trial')
    limit 1
  `;

  const workspaceId = String(rows[0]?.workspace_id ?? "").trim();
  const workspaceSlug = String(rows[0]?.slug ?? "").trim();
  if (!workspaceId || !workspaceSlug) return null;

  const websiteBuilder = await hasWorkspaceFeatureAccessForWorkspace(workspaceId, "website_builder");
  return websiteBuilder ? workspaceSlug : null;
}
