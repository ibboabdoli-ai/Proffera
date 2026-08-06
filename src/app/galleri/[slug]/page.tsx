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
  if (!items.length) {
    const companyName = String(workspace.company_name);
    const bookingSlug = String(workspace.booking_slug);
    return <main className="min-h-screen bg-[#f5f7f4] text-[#17201a]">
      <header className="bg-[#173e2b] text-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5"><a href={`/boka/${bookingSlug}`} className="text-lg font-black sm:text-xl">{companyName}</a><a href={`/boka/${bookingSlug}`} className="rounded-xl bg-white px-4 py-3 text-sm font-black text-[#173e2b]">Boka / Book</a></div></header>
      <section className="mx-auto max-w-3xl px-5 py-20 text-center"><p className="text-xs font-black uppercase tracking-[.18em] text-[#637068]">Galleri / Gallery</p><h1 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-6xl">Galleriet är klart</h1><p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#667168]">{companyName} har ännu inte publicerat några bilder eller videor. Publicerade medier visas här automatiskt.</p><a href={`/boka/${bookingSlug}`} className="mt-8 inline-flex rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-black text-white">Till bokningssidan</a></section>
    </main>;
  }

  return <PublicWorkspaceGallery items={items} companyName={String(workspace.company_name)} workspaceSlug={String(workspace.booking_slug)} />;
}
