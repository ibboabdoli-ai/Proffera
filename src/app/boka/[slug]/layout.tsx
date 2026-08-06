import type { ReactNode } from "react";

import { PublicWorkspaceGallery } from "@/components/public-workspace-gallery";
import { getSql } from "@/lib/db/server";
import { getPublicWorkspaceExperienceSettings } from "@/lib/workspace-experience";
import { getPublishedGalleryItems } from "@/lib/website-gallery-db";

import "./booking-themes.css";

export default async function PublicBookingLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sql = getSql();
  let gallery: ReactNode = null;
  let themeKey = "clean";
  let appearance = "light";

  if (sql) {
    const rows = await sql`
      select
        w.id,
        w.slug,
        coalesce(nullif(ws.company_name, ''), nullif(w.company_name, ''), w.name) as company_name
      from workspaces w
      left join workspace_settings ws on ws.workspace_id = w.id::text
      where w.public_booking_slug = ${slug}
        and w.status in ('active', 'trial')
      limit 1
    `;
    const workspace = rows[0];
    if (workspace) {
      const experience = await getPublicWorkspaceExperienceSettings(String(workspace.id));
      themeKey = experience.themeKey;
      appearance = experience.appearance;
      if (experience.galleryEnabled) {
        const items = await getPublishedGalleryItems(String(workspace.slug));
        gallery = <PublicWorkspaceGallery items={items} companyName={String(workspace.company_name)} workspaceSlug={slug} compact />;
      }
    }
  }

  return <div data-booking-theme={themeKey} data-booking-appearance={appearance}>{children}{gallery}</div>;
}
