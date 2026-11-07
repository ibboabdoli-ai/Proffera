import "server-only";

import { getSql } from "@/lib/db/server";

export type MariaCardTranslations = Map<string, { en: string; ar: string }>;

/**
 * Read only the Preview Maria bridal-card copy for the given workspace.
 * Missing schema stays on the site's established language-specific defaults;
 * only an authenticated Maria manager can save new translations.
 */
export async function readMariaCardTranslations(workspaceId: string): Promise<MariaCardTranslations> {
  const translations: MariaCardTranslations = new Map();
  if (process.env.VERCEL_ENV !== "preview") return translations;
  const sql = getSql();
  if (!sql) return translations;
  try {
    const rows = await sql`
      select s.public_slug, t.locale, t.description
      from maria_service_card_translations t
      join workspace_services s on s.id = t.service_id
      join workspaces w on w.id::text = s.workspace_id
      where w.id = ${workspaceId}::uuid
        and w.slug = 'makeup-by-maria'
        and w.status in ('active','trial')
        and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
        and t.locale in ('en','ar')
    `;
    for (const row of rows) {
      const slug = String(row.public_slug);
      const locale = String(row.locale);
      const value = row.description;
      if (!/^(maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6]))$/.test(slug)
        || (locale !== "en" && locale !== "ar")
        || typeof value !== "string" || value.length > 280) continue;
      const entry = translations.get(slug) ?? { en: "", ar: "" };
      entry[locale] = value;
      translations.set(slug, entry);
    }
  } catch (error) {
    // A missing 0074 table is expected on older Previews. All other read
    // failures must stop the editor: returning defaults could overwrite
    // existing translations on the manager's next save.
    if ((error as { code?: string } | null)?.code === "42P01") return new Map();
    console.error("Maria card translations could not be read", error);
    throw error;
  }
  return translations;
}
