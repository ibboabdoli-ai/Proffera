import { notFound } from "next/navigation";

import { PublicWorkspaceGallery } from "@/components/public-workspace-gallery";
import { getSql } from "@/lib/db/server";
import { getPublicWorkspaceExperienceSettings } from "@/lib/workspace-experience";
import { getPublishedGalleryItems } from "@/lib/website-gallery-db";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export default async function WorkspaceGalleryPage({ params }: PageProps) {
  const { slug } = await params;
  const sql = getSql();
  if (!sql) notFound();

  const rows = await sql`
    select
      w.id,
      w.slug,
      coalesce(nullif(w.public_booking_slug, ''), w.slug) as booking_slug,
      coalesce(nullif(ws.company_name, ''), nullif(w.company_name, ''), w.name) as company_name
    from workspaces w
    left join workspace_settings ws on ws.workspace_id = w.id::text
    where (w.slug = ${slug} or w.public_booking_slug = ${slug})
      and w.status in ('active', 'trial')
      and coalesce((
        select wp.status in ('active', 'trialing')
        from workspace_plans wp
        where wp.workspace_id = w.id
        order by wp.created_at desc
        limit 1
      ), false)
    limit 1
  `;
  const workspace = rows[0];
  if (!workspace) notFound();

  const experience = await getPublicWorkspaceExperienceSettings(String(workspace.id));
  if (!experience.galleryEnabled) notFound();

  const items = await getPublishedGalleryItems(String(workspace.slug));
  return <PublicWorkspaceGallery items={items} companyName={String(workspace.company_name)} workspaceSlug={String(workspace.booking_slug)} />;
}
