import "server-only";

import { getSql } from "@/lib/db/server";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

type MariaPreviewBookingReadiness =
  | { enabled: false }
  | {
      enabled: true;
      workspaceId: string;
      publicSlug: string;
      companyName: string;
      ownerEmail: string;
      ownerPhone: string;
      primaryCity: string;
      timeZone: string;
    };

/**
 * An explicitly opt-in, Preview-only bridge to Proffera's existing verified
 * booking flow. This must never make customer appointments in Production.
 * A valid plan/feature, published service, owner contact and slug are required.
 */
export async function getMariaPreviewBookingReadiness(): Promise<MariaPreviewBookingReadiness> {
  if (
    process.env.VERCEL_ENV !== "preview"
    || process.env.PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED !== "true"
  ) return { enabled: false };

  const sql = getSql();
  if (!sql) return { enabled: false };

  try {
    const rows = await sql`
      select w.id::text as workspace_id, w.public_booking_slug,
        coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
        coalesce(nullif(ws.primary_city, ''), w.primary_city, '') as primary_city,
        coalesce(nullif(ws.contact_email, ''), '') as owner_email,
        coalesce(nullif(ws.contact_phone, ''), '') as owner_phone,
        coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
      from workspaces w
      left join workspace_settings ws on ws.workspace_id = w.id::text
      where w.slug = 'makeup-by-maria'
        and w.status in ('active', 'trial')
        and w.public_booking_slug = 'makeup-by-maria'
        and exists (
          select 1 from workspace_services s
          where s.workspace_id = w.id::text
            and s.is_active = true
            and s.public_status = 'published'
            and s.duration_minutes between 1 and 1440
            and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
        )
      limit 1
    `;
    const row = rows[0];
    if (!row || !row.owner_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.owner_email))) {
      return { enabled: false };
    }

    const workspaceId = String(row.workspace_id);
    if (!await hasWorkspaceFeatureAccessForWorkspace(workspaceId, "online_booking")) {
      return { enabled: false };
    }

    return {
      enabled: true,
      workspaceId,
      publicSlug: "makeup-by-maria",
      companyName: String(row.company_name),
      ownerEmail: String(row.owner_email),
      ownerPhone: String(row.owner_phone),
      primaryCity: String(row.primary_city),
      timeZone: String(row.time_zone),
    };
  } catch (error) {
    console.error("Maria preview booking readiness failed", error);
    return { enabled: false };
  }
}
