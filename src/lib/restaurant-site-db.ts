import "server-only";

import { getSql } from "@/lib/db/server";
import {
  canManageWorkspaceSettings,
  getUserWorkspaceAccess,
} from "@/lib/workspace-access";
import {
  emptyRestaurantSite,
  validateRestaurantSite,
  type RestaurantSite,
} from "@/lib/restaurant-site-schema";
import {
  createDonisAdminStarterSite,
  isRestaurantSiteBlank,
} from "@/lib/donis-fallback";

const slug = "donis-trattoria";

function readSite(value: unknown): RestaurantSite {
  const parsed = validateRestaurantSite(value);
  return parsed.ok ? parsed.site : emptyRestaurantSite;
}

export async function getRestaurantAdmin() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) return null;
  const sql = getSql();
  if (!sql) return null;
  let rows;
  try {
    rows = await sql`
      select draft, published, draft_revision, published_revision
      from restaurant_sites
      where workspace_id=${access.workspaceId}::uuid and public_slug=${slug}
      limit 1
    `;
  } catch {
    return null;
  }
  if (!rows[0]) return null;
  const draft = readSite(rows[0].draft);
  const published = rows[0].published ? readSite(rows[0].published) : null;
  const starter = !published && isRestaurantSiteBlank(draft);
  return {
    draft: starter ? createDonisAdminStarterSite() : draft,
    published,
    revision: Number(rows[0].draft_revision),
    publishedRevision:
      rows[0].published_revision == null
        ? null
        : Number(rows[0].published_revision),
    starter,
  };
}

export async function getPublishedRestaurantSite(): Promise<RestaurantSite | null> {
  const sql = getSql();
  if (!sql) return null;
  try {
    const rows = await sql`
      select r.published from restaurant_sites r
      join workspaces w on w.id=r.workspace_id
      where r.public_slug=${slug} and w.status in ('active','trial') and r.published is not null
      limit 1
    `;
    return rows[0] ? readSite(rows[0].published) : null;
  } catch {
    return null;
  }
}

export async function hasRestaurantSite(workspaceId: string) {
  const sql = getSql();
  if (!sql) return false;
  try {
    const rows =
      await sql`select id from restaurant_sites where workspace_id=${workspaceId}::uuid and public_slug=${slug} limit 1`;
    return Boolean(rows[0]);
  } catch {
    return false;
  }
}

export async function getRestaurantImageUrls(
  site: RestaurantSite,
): Promise<Record<string, string>> {
  const sql = getSql();
  if (!sql) return {};
  const ids = [
    ...new Set(
      [
        site.media.hero?.id,
        site.media.owner?.id,
        site.media.family?.id,
        ...site.media.gallery.map((item) => item.id),
        ...site.dishes.map((dish) => dish.image?.id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  if (!ids.length) return {};
  try {
    const rows = await sql`
      select g.id::text, g.public_url from website_gallery_items g
      join restaurant_sites r on r.workspace_id=g.workspace_id
      join workspaces w on w.id=r.workspace_id
      where r.public_slug=${slug} and w.status in ('active','trial')
        and g.media_type='image' and g.id::text=any(${ids}::text[])
    `;
    return Object.fromEntries(
      rows.map((row) => [String(row.id), String(row.public_url)]),
    );
  } catch {
    return {};
  }
}

async function mediaBelongsToWorkspace(
  site: RestaurantSite,
  workspaceId: string,
) {
  const sql = getSql();
  if (!sql) return false;
  const media = [
    site.media.hero,
    site.media.owner,
    site.media.family,
    ...site.media.gallery,
    ...site.dishes.map((dish) => dish.image),
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const ids = [...new Set(media.map((item) => item.id))];
  if (!ids.length) return true;
  const rows = await sql`
    select id::text from website_gallery_items
    where workspace_id=${workspaceId}::uuid and media_type='image' and id::text = any(${ids}::text[])
  `;
  return rows.length === ids.length;
}

export async function saveRestaurantDraft(value: unknown, revision: number) {
  const access = await getUserWorkspaceAccess();
  const sql = getSql();
  if (!access.ok || !canManageWorkspaceSettings(access) || !sql)
    return { ok: false as const, error: "Ingen behörighet." };
  const parsed = validateRestaurantSite(value);
  if (!parsed.ok) return parsed;
  if (!Number.isSafeInteger(revision) || revision < 0) {
    return { ok: false as const, error: "En bild eller version är ogiltig." };
  }

  const media = [
    parsed.site.media.hero,
    parsed.site.media.owner,
    parsed.site.media.family,
    ...parsed.site.media.gallery,
    ...parsed.site.dishes.map((dish) => dish.image),
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const mediaIds = [...new Set(media.map((item) => item.id))];
  const lockKey = `restaurant-site:${access.workspaceId}`;

  const [, rows] = await sql.transaction(
    (txn) => [
      txn`
        select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
      `,
      txn`
        with media_guard as (
          select count(*)::int as media_count
          from website_gallery_items
          where workspace_id=${access.workspaceId}::uuid
            and media_type='image'
            and id::text=any(${mediaIds}::text[])
        ), updated as (
          update restaurant_sites
          set draft=${JSON.stringify(parsed.site)}::jsonb,
              draft_revision=draft_revision+1,
              updated_at=now()
          where workspace_id=${access.workspaceId}::uuid
            and public_slug=${slug}
            and draft_revision=${revision}
            and (select media_count from media_guard)=${mediaIds.length}
          returning draft_revision
        )
        select
          (select media_count from media_guard)::int as media_count,
          (select draft_revision from updated) as draft_revision
      `,
    ],
    { isolationLevel: "ReadCommitted" },
  );

  const row = rows[0] as Record<string, unknown> | undefined;
  if (Number(row?.media_count ?? -1) !== mediaIds.length) {
    return { ok: false as const, error: "En bild eller version är ogiltig." };
  }
  if (row?.draft_revision == null) {
    return {
      ok: false as const,
      error: "En annan ändring sparades. Ladda om sidan innan du fortsätter.",
    };
  }
  return { ok: true as const, revision: Number(row.draft_revision) };
}

export async function publishRestaurantDraft(revision: number) {
  const access = await getUserWorkspaceAccess();
  const sql = getSql();
  if (!access.ok || !canManageWorkspaceSettings(access) || !sql)
    return { ok: false as const, error: "Ingen behörighet." };
  if (!Number.isSafeInteger(revision) || revision < 1)
    return { ok: false as const, error: "Spara ett utkast först." };
  const rows = await sql`
    select draft from restaurant_sites
    where workspace_id=${access.workspaceId}::uuid and public_slug=${slug} and draft_revision=${revision}
    limit 1
  `;
  if (!rows[0])
    return { ok: false as const, error: "Utkastet ändrades. Ladda om sidan." };
  const parsed = validateRestaurantSite(rows[0].draft);
  if (!parsed.ok) return parsed;
  const hiddenCategoryIds = new Set(
    parsed.site.categories
      .filter((category) => category.hidden)
      .map((category) => category.id),
  );
  if (
    parsed.site.dishes.some(
      (dish) =>
        !dish.archived &&
        !dish.hidden &&
        !hiddenCategoryIds.has(dish.categoryId) &&
        dish.priceOre === null,
    )
  ) {
    return {
      ok: false as const,
      error: "Alla synliga rätter behöver ett pris före publicering.",
    };
  }
  if (!(await mediaBelongsToWorkspace(parsed.site, access.workspaceId))) {
    return {
      ok: false as const,
      error: "En bild finns inte längre i mediabiblioteket.",
    };
  }
  const updated = await sql`
    update restaurant_sites
    set published=draft, published_revision=draft_revision, published_at=now(), updated_at=now()
    where workspace_id=${access.workspaceId}::uuid and public_slug=${slug} and draft_revision=${revision}
    returning published_revision
  `;
  return updated[0]
    ? { ok: true as const, revision: Number(updated[0].published_revision) }
    : { ok: false as const, error: "Utkastet ändrades. Ladda om sidan." };
}
