import "server-only";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";
import { getSql } from "@/lib/db/server";
import { getPlatformAdmin } from "@/lib/platform-admin";

type PublishResult = {
  ok: boolean;
  code: "published" | "invalid" | "not_found" | "not_ready" | "unsafe" | "low_confidence" | "database";
  slug?: string;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function requireSuperAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
  return admin;
}

export async function publishCompanyDirectoryProfileFromAdmin(profileId: string): Promise<PublishResult> {
  await requireSuperAdmin();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    return { ok: false, code: "invalid" };
  }

  const sql = getSql();
  if (!sql) return { ok: false, code: "database" };

  const rows = await sql`
    select
      p.id::text, p.public_slug, p.display_name, p.legal_name,
      p.category_slug, p.primary_sni_code, p.activity_description,
      p.publication_status, p.is_active, p.privacy_blocked,
      p.auto_public_eligible, p.claimed_workspace_id,
      f.registered_names, f.sni_codes, f.deregistration_date,
      f.advertising_blocked, f.ongoing_procedures
    from company_directory_profiles p
    left join company_directory_official_facts f on f.profile_id = p.id
    where p.id = ${profileId}::uuid
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, code: "not_found" };
  if (text(row.publication_status) !== "ready") return { ok: false, code: "not_ready" };

  const confidence = assessCompanyDirectoryCategoryConfidence({
    categorySlug: text(row.category_slug),
    primarySniCode: text(row.primary_sni_code),
    legalName: text(row.legal_name),
    displayName: text(row.display_name),
    activityDescription: text(row.activity_description),
    registeredNames: row.registered_names,
    sniCodes: row.sni_codes,
  });

  const unsafe = !Boolean(row.is_active)
    || Boolean(row.privacy_blocked)
    || !Boolean(row.auto_public_eligible)
    || Boolean(row.claimed_workspace_id)
    || !confidence.officialFactsReady
    || Boolean(row.deregistration_date)
    || Boolean(row.advertising_blocked)
    || jsonArray(row.ongoing_procedures).length > 0;
  if (unsafe) return { ok: false, code: "unsafe" };
  if (confidence.score < 95) return { ok: false, code: "low_confidence" };

  const updated = await sql`
    update company_directory_profiles
    set publication_status = 'published',
        published_at = coalesce(published_at, now()),
        updated_at = now()
    where id = ${profileId}::uuid
      and publication_status = 'ready'
      and is_active = true
      and privacy_blocked = false
      and auto_public_eligible = true
      and claimed_workspace_id is null
    returning public_slug
  `;
  if (!updated[0]) return { ok: false, code: "not_ready" };

  return { ok: true, code: "published", slug: text(updated[0].public_slug) };
}
