import "server-only";

import { getSql } from "@/lib/db/server";
import { resolveBrevoApiKey } from "@/lib/email-runtime-config";
import { inspectMariaProductionActivationRequest } from "@/lib/maria-production-activation-policy";
import { getMariaPreviewBookingReadiness } from "@/lib/maria-preview-booking";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

type MariaBookingReadiness = Awaited<ReturnType<typeof getMariaPreviewBookingReadiness>>;

/**
 * Maria's Production-only read gate. Preview remains on its original isolated
 * inbox contract. All Production feature switches are OFF by default and
 * cannot substitute for real schema, owner, service or entitlement checks.
 */
export async function getMariaBookingReadiness(): Promise<MariaBookingReadiness> {
  if (process.env.VERCEL_ENV === "preview") {
    return getMariaPreviewBookingReadiness();
  }
  if (!inspectMariaProductionActivationRequest().requested || !resolveBrevoApiKey()) {
    return { enabled: false };
  }

  const sql = getSql();
  if (!sql) return { enabled: false };

  try {
    // Inspect the actual Production schema before querying dependent tables.
    const schema = await sql`
      select
        to_regclass('public.proffera_schema_migrations') is not null as ledger,
        to_regclass('public.maria_manual_closed_starts') is not null as closed_starts,
        to_regclass('public.maria_service_card_translations') is not null as translations,
        to_regclass('public.public_booking_verifications') is not null as verifications,
        (select count(*) from information_schema.columns
         where table_schema='public' and table_name='public_booking_verifications'
           and column_name in ('address','postcode','booking_details')) = 3 as contact_columns
    `;
    const s = schema[0];
    if (!s || ![s.ledger, s.closed_starts, s.translations, s.verifications, s.contact_columns]
      .every(value => value === true)) return { enabled: false };

    const ledger = await sql`
      select count(distinct migration_key)::int as count
      from proffera_schema_migrations
      where migration_key in ('20261103_0072', '20261105_0073', '20261107_0074')
    `;
    if (Number(ledger[0]?.count) !== 3) return { enabled: false };

    const rows = await sql`
      select w.id::text as workspace_id, w.public_booking_slug,
        coalesce(nullif(ws.company_name,''),w.company_name,w.name) as company_name,
        coalesce(nullif(ws.primary_city,''),w.primary_city,'') as primary_city,
        coalesce(nullif(ws.contact_email,''),'') as owner_email,
        coalesce(nullif(ws.contact_phone,''),'') as owner_phone,
        coalesce(nullif(ws.time_zone,''),'Europe/Stockholm') as time_zone,
        ws.billing_currency
      from workspaces w
      left join workspace_settings ws on ws.workspace_id=w.id::text
      where w.slug='makeup-by-maria' and w.status in ('active','trial')
        and w.public_booking_slug='makeup-by-maria'
        and exists (
          select 1 from workspace_services s
          where s.workspace_id=w.id::text and s.is_active=true
            and s.public_status='published' and s.duration_minutes between 1 and 1440
            and s.price_type='fixed' and s.price_amount_minor between 0 and 25000000
            and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
        )
      limit 2
    `;
    if (rows.length !== 1) return { enabled: false };
    const row = rows[0];
    if (row.time_zone !== "Europe/Stockholm" || row.billing_currency !== "SEK"
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.owner_email ?? ""))) {
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
    console.error("Maria Production booking readiness refused", error);
    return { enabled: false };
  }
}
