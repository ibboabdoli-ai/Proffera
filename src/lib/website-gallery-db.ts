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

type CreateGalleryItemInput = Omit<GalleryItem, "id" | "status" | "isFeatured" | "sortOrder"> & {
  id?: string;
  mediaBase64?: string | null;
};

export type GalleryMediaMetadata = {
  workspaceId: string;
  status: GalleryItem["status"];
  mimeType: string;
  bytes: number;
};

export type GalleryMediaRecord = GalleryMediaMetadata & {
  mediaBase64: string;
};

function isGalleryMediaId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

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
  const rows = await sql`
    select id,media_type,public_url,storage_key,title,caption,alt_text,display_style,status,is_featured,sort_order,mime_type,bytes
    from website_gallery_items
    where workspace_id=${access.workspaceId}::uuid
    order by sort_order asc, created_at desc
    limit 200
  `;
  return rows.map(mapItem);
}

export async function getPublishedGalleryItems(workspaceSlug: string) {
  const sql = getSql();
  if (!sql) return [];
  const rows = await sql`
    select g.id,g.media_type,g.public_url,g.storage_key,g.title,g.caption,g.alt_text,g.display_style,g.status,g.is_featured,g.sort_order,g.mime_type,g.bytes
    from website_gallery_items g
    join workspaces w on w.id=g.workspace_id
    where w.slug=${workspaceSlug} and w.status in ('active','trial') and g.status='published'
    order by g.is_featured desc, g.sort_order asc, g.published_at desc nulls last
  `;
  return rows.map(mapItem);
}

export async function createGalleryItem(input: CreateGalleryItemInput) {
  const [access, sql] = await Promise.all([getUserWorkspaceAccess(), Promise.resolve(getSql())]);
  if (!access.ok || !canManageWorkspaceSettings(access) || !sql) return false;

  const id = input.id ?? crypto.randomUUID();
  const rows = input.mediaBase64
    ? await sql`
        insert into website_gallery_items(
          id,workspace_id,media_type,public_url,storage_key,title,caption,alt_text,display_style,mime_type,bytes,media_data
        )
        values(
          ${id}::uuid,${access.workspaceId}::uuid,${input.mediaType},${input.publicUrl},${input.storageKey},${input.title},${input.caption},${input.altText},${input.displayStyle},${input.mimeType},${input.bytes},decode(${input.mediaBase64},'base64')
        ) returning id
      `
    : await sql`
        insert into website_gallery_items(
          id,workspace_id,media_type,public_url,storage_key,title,caption,alt_text,display_style,mime_type,bytes
        )
        values(
          ${id}::uuid,${access.workspaceId}::uuid,${input.mediaType},${input.publicUrl},${input.storageKey},${input.title},${input.caption},${input.altText},${input.displayStyle},${input.mimeType},${input.bytes}
        ) returning id
      `;
  return Boolean(rows[0]?.id);
}

export async function getGalleryMediaMetadata(id: string): Promise<GalleryMediaMetadata | null> {
  if (!isGalleryMediaId(id)) return null;
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`
    select workspace_id,status,mime_type,bytes
    from website_gallery_items
    where id=${id}::uuid and media_data is not null
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    workspaceId: String(row.workspace_id),
    status: String(row.status) as GalleryItem["status"],
    mimeType: String(row.mime_type),
    bytes: Number(row.bytes ?? 0),
  };
}

export async function getGalleryMediaBase64(id: string, start?: number, length?: number): Promise<string | null> {
  if (!isGalleryMediaId(id)) return null;
  const sql = getSql();
  if (!sql) return null;

  const hasRange = Number.isInteger(start) && Number.isInteger(length) && Number(start) >= 0 && Number(length) > 0;
  const rows = hasRange
    ? await sql`
        select encode(substring(media_data from ${Number(start) + 1} for ${Number(length)}),'base64') as media_base64
        from website_gallery_items
        where id=${id}::uuid and media_data is not null
        limit 1
      `
    : await sql`
        select encode(media_data,'base64') as media_base64
        from website_gallery_items
        where id=${id}::uuid and media_data is not null
        limit 1
      `;

  const value = rows[0]?.media_base64;
  return value ? String(value) : null;
}

export async function getGalleryMedia(id: string): Promise<GalleryMediaRecord | null> {
  const metadata = await getGalleryMediaMetadata(id);
  if (!metadata) return null;
  const mediaBase64 = await getGalleryMediaBase64(id);
  if (!mediaBase64) return null;
  return { ...metadata, mediaBase64 };
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
