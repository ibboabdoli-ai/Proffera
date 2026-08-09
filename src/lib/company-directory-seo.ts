import "server-only";

import { getSql } from "@/lib/db/server";

function isMissingDirectorySchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const row = error as { code?: unknown; message?: unknown };
  return String(row.code ?? "") === "42P01"
    || String(row.message ?? "").includes("company_directory_profiles");
}

export async function listPublishedDirectorySitemapEntries(limit = 5000) {
  const sql = getSql();
  if (!sql) return [] as Array<{ slug: string; lastModified: Date }>;
  const safeLimit = Math.max(1, Math.min(5000, limit));

  try {
    const rows = await sql`
      select public_slug, coalesce(source_updated_at, updated_at, published_at, created_at) as last_modified
      from company_directory_profiles
      where publication_status = 'published'
        and privacy_blocked = false
        and auto_public_eligible = true
      order by coalesce(source_updated_at, updated_at, published_at, created_at) desc
      limit ${safeLimit}
    `;

    return rows.map((row) => ({
      slug: String(row.public_slug),
      lastModified: new Date(String(row.last_modified)),
    })).filter((row) => row.slug && Number.isFinite(row.lastModified.getTime()));
  } catch (error) {
    if (isMissingDirectorySchema(error)) return [] as Array<{ slug: string; lastModified: Date }>;
    throw error;
  }
}
