import "server-only";

import { getSql } from "@/lib/db/server";
import { resolveAuthSecret, resolveCustomerPortalSecret } from "@/lib/auth-secret";
import { resolveBrevoApiKey } from "@/lib/email-runtime-config";
import { resolveBookingSender } from "@/features/email/booking-verification-email";
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
  if (!inspectMariaProductionActivationRequest().requested || !resolveBrevoApiKey()
    || !resolveAuthSecret() || !resolveCustomerPortalSecret()) {
    return { enabled: false };
  }
  // Customer OTPs must be non-predictably hashed and the personal booking
  // portal must be signable BEFORE a booking/hold can be committed. Status
  // emails also need an actual configured sender.
  // Validate the actual OTP sender, not only the independent status-mail sender.
  // resolveBookingSender is also used by the Brevo OTP request itself.
  const otpSenderAddress = resolveBookingSender().email;
  const from = process.env.LEAD_FROM_EMAIL?.trim();
  const senderAddress = from?.match(/<([^<>]+)>$/)?.[1]?.trim() ?? from;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(otpSenderAddress)
    || !senderAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderAddress)) {
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
        to_regclass('public.maria_booking_references') is not null as booking_references,
        to_regclass('public.maria_booking_reference_counters') is not null as reference_counters,
        to_regclass('public.public_booking_verifications') is not null as verifications,
        (select count(*) from information_schema.columns
         where table_schema='public' and table_name='public_booking_verifications'
           and column_name in ('address','postcode','booking_details')) = 3 as contact_columns
    `;
    const s = schema[0];
    if (!s || ![s.ledger, s.closed_starts, s.translations, s.booking_references,
      s.reference_counters, s.verifications, s.contact_columns]
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
          as card_translations_fk,
        (select count(*) from information_schema.columns where table_schema='public'
          and table_name='maria_booking_reference_counters' and (
          (column_name='day_key' and udt_name='text' and is_nullable='NO') or
          (column_name='last_number' and udt_name='int8' and is_nullable='NO')
        )) = 2 as reference_counter_columns,
        (select count(*) from information_schema.columns where table_schema='public'
          and table_name='maria_booking_references' and (
          (column_name='booking_id' and udt_name='uuid' and is_nullable='NO') or
          (column_name='day_key' and udt_name='text' and is_nullable='NO') or
          (column_name='day_number' and udt_name='int8' and is_nullable='NO') or
          (column_name='reference' and udt_name='text' and is_nullable='NO')
        )) = 4 as booking_reference_columns,
        exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_reference_counters') AND c.contype='p' AND c.conname='maria_booking_reference_counters_pkey' AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (day_key)') as reference_counter_pk,
        exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='p' AND c.conname='maria_booking_references_pkey' AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (booking_id)') as booking_reference_pk,
        exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='u' AND c.conname='maria_booking_references_reference_key' AND pg_get_constraintdef(c.oid) = 'UNIQUE (reference)') as booking_reference_unique,
        exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='u' AND c.conname='maria_booking_reference_day_number_key' AND pg_get_constraintdef(c.oid) = 'UNIQUE (day_key, day_number)') as booking_reference_day_unique,
        exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='f' AND c.conname='maria_booking_references_booking_id_fkey' AND c.confrelid=to_regclass('public.bookings') AND c.confdeltype='c' AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (booking_id) REFERENCES %(id) ON DELETE CASCADE') as booking_reference_booking_fk,
        exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='f' AND c.conname='maria_booking_references_day_key_fkey' AND c.confrelid=to_regclass('public.maria_booking_reference_counters') AND c.confdeltype='a' AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (day_key) REFERENCES %(day_key)') as booking_reference_day_fk,
        exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_reference_counters') AND c.contype='c' AND c.conname='maria_booking_reference_counters_day_key_check' AND c.convalidated AND pg_get_constraintdef(c.oid) = 'CHECK ((day_key ~ ''^[0-9]{8}$''::text))') as reference_counter_day_check,
        exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_reference_counters') AND c.contype='c' AND c.conname='maria_booking_reference_counters_last_number_check' AND c.convalidated AND pg_get_constraintdef(c.oid) = 'CHECK (((last_number >= 1) AND (last_number <= 999999999)))') as reference_counter_number_check,
        exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='c' AND c.conname='maria_booking_references_day_number_check' AND c.convalidated AND pg_get_constraintdef(c.oid) = 'CHECK (((day_number >= 1) AND (day_number <= 999999999)))') as booking_reference_number_check,
        exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='c' AND c.conname='maria_booking_references_reference_check' AND c.convalidated AND pg_get_constraintdef(c.oid) = 'CHECK ((reference ~ ''^MBM-[0-9]{10,}$''::text))') as booking_reference_format_check
    `;
    const contract = integrity[0];
    if (!contract || ![
      contract.manual_closed_columns, contract.card_translations_columns,
      contract.manual_closed_pk, contract.card_translations_pk,
      contract.manual_closed_fk, contract.card_translations_fk,
      contract.reference_counter_columns, contract.booking_reference_columns,
      contract.reference_counter_pk, contract.booking_reference_pk, contract.booking_reference_unique, contract.booking_reference_day_unique, contract.booking_reference_booking_fk, contract.booking_reference_day_fk, contract.reference_counter_day_check, contract.reference_counter_number_check, contract.booking_reference_number_check, contract.booking_reference_format_check,
    ].every(value => value === true)) return { enabled: false };

    const ledger = await sql`
      select count(distinct migration_key)::int as count
      from proffera_schema_migrations
      where migration_key in ('20261103_0072', '20261105_0073', '20261107_0074', '20261110_0076')
    `;
    if (Number(ledger[0]?.count) !== 4) return { enabled: false };

    const rows = await sql`
      select w.id::text as workspace_id, w.public_booking_slug,
        coalesce(nullif(ws.company_name,''),w.company_name,w.name) as company_name,
        coalesce(nullif(ws.primary_city,''),w.primary_city,'') as primary_city,
        coalesce(nullif(ws.contact_email,''),'') as owner_email,
        coalesce(nullif(ws.contact_phone,''),'') as owner_phone,
        coalesce(nullif(ws.time_zone,''),'Europe/Stockholm') as time_zone,
        ws.billing_currency,
        exists (
          select 1
          from workspace_billing_subscriptions billing
          join workspace_plans plan
            on plan.id=billing.workspace_plan_id
           and plan.workspace_id=billing.workspace_id
          where billing.workspace_id=w.id
            and billing.status='active'
            and plan.status='active'
            and plan.plan_key in ('starter','professional','business')
            and billing.stripe_customer_id is not null
            and billing.stripe_subscription_id is not null
            and billing.stripe_price_id is not null
            and billing.current_period_start <= now()
            and billing.current_period_end > now()
            and plan.current_period_end > now()
        ) as paid_subscription_active
      from workspaces w
      left join workspace_settings ws on ws.workspace_id=w.id::text
      where w.slug='makeup-by-maria' and w.status in ('active','trial')
        and w.public_booking_slug='makeup-by-maria'
        and exists (
          select 1 from workspace_services s
          where s.workspace_id=w.id::text and s.is_active=true
            and s.public_status='published' and s.duration_minutes between 1 and 1440
            and s.price_type='fixed' and s.price_amount_minor between 1 and 25000000
            and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
        )
        and not exists (
          select 1 from workspace_services unsafe
          where unsafe.workspace_id=w.id::text and unsafe.is_active=true
            and unsafe.public_status='published'
            and unsafe.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
            and (unsafe.price_type IS DISTINCT FROM 'fixed' or unsafe.price_amount_minor is null
              or unsafe.price_amount_minor not between 1 and 25000000)
        )
      limit 2
    `;
    if (rows.length !== 1) return { enabled: false };
    const row = rows[0];
    if (row.time_zone !== "Europe/Stockholm" || row.billing_currency !== "SEK"
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.owner_email ?? ""))) {
      return { enabled: false };
    }

    // Admin overrides and free trials never replace a live, paid Stripe plan
    // for NEW Maria bookings. Existing booking lifecycle has separate guards.
    if (row.paid_subscription_active !== true) return { enabled: false };
    const workspaceId = String(row.workspace_id);
    if (!await hasWorkspaceFeatureAccessForWorkspace(workspaceId, "online_booking")) {
      return { enabled: false };
    }

    // Every live OTP, finalization, customer self-service and manager write
    // rechecks this readiness and its own tenant/recipient authorization.
    // Nothing becomes bookable unless all Production switches and the real
    // schema/ledger/service/entitlement requirements above pass together.
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
