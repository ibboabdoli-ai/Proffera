import "server-only";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export type GalleryItem = {
  id: string;
  mediaType: "image" | "video";
  publicUrl: string;
  storageKey: string;
  title: string | null;
  caption: string | null;
  altText: string;
  displayStyle: "grid" | "masonry" | "slider" | "hero" | "video";
  status: "draft" | "published" | "hidden";
  isFeatured: boolean;
  sortOrder: number;
  mimeType: string;
  bytes: number;
};

function mapItem(row: Record<string, unknown>): GalleryItem {
  return {
    id: String(row.id),
    mediaType: row.media_type === "video" ? "video" : "image",
    publicUrl: String(row.public_url),
    storageKey: String(row.storage_key),
    title: row.title ? String(row.title) : null,
    caption: row.caption ? String(row.caption) : null,
    altText: String(row.alt_text),
    displayStyle: String(row.display_style) as GalleryItem["displayStyle"],
    status: String(row.status) as GalleryItem["status"],
    isFeatured: Boolean(row.is_featured),
    sortOrder: Number(row.sort_order ?? 0),
    mimeType: String(row.mime_type),
    bytes: Number(row.bytes ?? 0),
  };
}

export async function getDashboardGalleryItems() {
  const [access, sql] = await Promise.all([getUserWorkspaceAccess(), Promise.resolve(getSql())]);
  if (!access.ok || !canManageWorkspaceSettings(access) || !sql) return [];
  const rows = await sql`select * from website_gallery_items where workspace_id=${access.workspaceId}::uuid order by sort_order asc, created_at desc limit 200`;
  return rows.map(mapItem);
}

export async function getPublishedGalleryItems(workspaceSlug: string) {
  const sql = getSql();
  if (!sql) return [];
  const rows = await sql`
    select g.* from website_gallery_items g join workspaces w on w.id=g.workspace_id
    where w.slug=${workspaceSlug} and w.status in ('active','trial') and g.status='published'
    order by g.is_featured desc, g.sort_order asc, g.published_at desc nulls last
  `;
  return rows.map(mapItem);
}

export async function createGalleryItem(input: Omit<GalleryItem, "id" | "status" | "isFeatured" | "sortOrder">) {
  const [access, sql] = await Promise.all([getUserWorkspaceAccess(), Promise.resolve(getSql())]);
  if (!access.ok || !canManageWorkspaceSettings(access) || !sql) return false;
  const rows = await sql`
    insert into website_gallery_items(workspace_id,media_type,public_url,storage_key,title,caption,alt_text,display_style,mime_type,bytes)
    values(${access.workspaceId}::uuid,${input.mediaType},${input.publicUrl},${input.storageKey},${input.title},${input.caption},${input.altText},${input.displayStyle},${input.mimeType},${input.bytes}) returning id
  `;
  return Boolean(rows[0]?.id);
}

export async function updateGalleryItem(id: string, action: "publish" | "hide" | "delete") {
  const [access, sql] = await Promise.all([getUserWorkspaceAccess(), Promise.resolve(getSql())]);
  if (!access.ok || !canManageWorkspaceSettings(access) || !sql) return false;
  if (action === "delete") {
    const rows = await sql`delete from website_gallery_items where id=${id}::uuid and workspace_id=${access.workspaceId}::uuid returning id`;
    return Boolean(rows[0]?.id);
  }
  const status = action === "publish" ? "published" : "hidden";
  const rows = await sql`update website_gallery_items set status=${status}, published_at=case when ${status}='published' then coalesce(published_at,now()) else null end, updated_at=now() where id=${id}::uuid and workspace_id=${access.workspaceId}::uuid returning id`;
  return Boolean(rows[0]?.id);
}