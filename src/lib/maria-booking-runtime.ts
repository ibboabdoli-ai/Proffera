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

    // A migration receipt and relation name do not prove CREATE TABLE IF NOT
    // EXISTS installed the expected columns and keys. Recheck the canonical
    // 0072/0074 contract in the live runtime gate, not only in the CLI preflight.
    const integrity = await sql`
      select
        (select count(*) from information_schema.columns
         where table_schema='public' and table_name='maria_manual_closed_starts' and (
           (column_name='workspace_id' and udt_name='uuid' and is_nullable='NO') or
           (column_name='starts_at' and udt_name='timestamptz' and is_nullable='NO') or
           (column_name='created_by' and udt_name='text' and is_nullable='NO') or
           (column_name='created_at' and udt_name='timestamptz' and is_nullable='NO')
         )) = 4 as manual_closed_columns,
        (select count(*) from information_schema.columns
         where table_schema='public' and table_name='maria_service_card_translations' and (
           (column_name='service_id' and udt_name='uuid' and is_nullable='NO') or
           (column_name='locale' and udt_name='text' and is_nullable='NO') or
           (column_name='description' and udt_name='text' and is_nullable='NO') or
           (column_name='updated_at' and udt_name='timestamptz' and is_nullable='NO')
         )) = 4 as card_translations_columns,
        exists (select 1 from pg_constraint c
          where c.conrelid=to_regclass('public.maria_manual_closed_starts')
            and c.contype='p' and c.conname='maria_manual_closed_starts_pk'
            and pg_get_constraintdef(c.oid)='PRIMARY KEY (workspace_id, starts_at)')
          as manual_closed_pk,
        exists (select 1 from pg_constraint c
          where c.conrelid=to_regclass('public.maria_service_card_translations')
            and c.contype='p' and c.conname='maria_service_card_translations_pk'
            and pg_get_constraintdef(c.oid)='PRIMARY KEY (service_id, locale)')
          as card_translations_pk,
        exists (select 1 from pg_constraint c
          where c.conrelid=to_regclass('public.maria_manual_closed_starts')
            and c.contype='f' and c.confrelid=to_regclass('public.workspaces')
            and c.confdeltype='c' and pg_get_constraintdef(c.oid)
              like 'FOREIGN KEY (workspace_id) REFERENCES %')
          as manual_closed_fk,
        exists (select 1 from pg_constraint c
          where c.conrelid=to_regclass('public.maria_service_card_translations')
            and c.contype='f' and c.confrelid=to_regclass('public.workspace_services')
            and c.confdeltype='c' and pg_get_constraintdef(c.oid)
              like 'FOREIGN KEY (service_id) REFERENCES %')
          as card_translations_fk
    `;
    const contract = integrity[0];
    if (!contract || ![
      contract.manual_closed_columns, contract.card_translations_columns,
      contract.manual_closed_pk, contract.card_translations_pk,
      contract.manual_closed_fk, contract.card_translations_fk,
    ].every(value => value === true)) return { enabled: false };

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

    // Critical P1: Production OTP resend/verify/finalization, manager status,
    // manual calendar, and Swish recording remain Preview-only. No combination
    // of environment flags or healthy schema may open public booking until
    // those real customer/manager handlers have been implemented and tested.
    const productionBookingLifecycleComplete = false;
    if (!productionBookingLifecycleComplete) return { enabled: false };

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
