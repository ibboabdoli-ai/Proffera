import "server-only";

import { getSql } from "@/lib/db/server";

export async function getClaimedDirectoryWorkspaceSlug(directorySlug: string) {
  const slug = directorySlug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    select workspace.slug
    from company_directory_profiles profile
    join workspaces workspace on workspace.id = profile.claimed_workspace_id
    where profile.public_slug = ${slug}
      and profile.publication_status = 'claimed'
      and profile.claimed_workspace_id is not null
      and workspace.status in ('active', 'trial')
    limit 1
  `;

  const workspaceSlug = String(rows[0]?.slug ?? "").trim();
  return workspaceSlug || null;
}
