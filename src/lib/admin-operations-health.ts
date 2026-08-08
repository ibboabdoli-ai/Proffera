import "server-only";

import { getSql } from "@/lib/db/server";

export type OperationsHealthLevel = "ok" | "warning" | "critical";

export type OperationsHealthSignal = {
  key: string;
  label: string;
  level: OperationsHealthLevel;
  detail: string;
};

const expectedTenantConstraintCount = 17;

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isConfigured(value: string | undefined) {
  return Boolean(value?.trim());
}

export function getOperationsConfigSignals(env: NodeJS.ProcessEnv = process.env): OperationsHealthSignal[] {
  const deployed = env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
  const signals: OperationsHealthSignal[] = [];

  signals.push({
    key: "public_form_secret",
    label: "Public form rate-limit secret",
    level: deployed && !isConfigured(env.PUBLIC_FORM_RATE_LIMIT_SECRET) ? "critical" : "ok",
    detail: deployed
      ? isConfigured(env.PUBLIC_FORM_RATE_LIMIT_SECRET)
        ? "Configured for this deployed environment."
        : "Missing. Public submissions fail closed until it is configured."
      : "Local development may use the documented deterministic fallback.",
  });

  signals.push({
    key: "reminder_cron_secret",
    label: "Reminder scheduler secret",
    level: deployed && !isConfigured(env.CRON_SECRET) ? "critical" : "ok",
    detail: isConfigured(env.CRON_SECRET)
      ? "Configured."
      : deployed
        ? "Missing. The booking reminder scheduler cannot authenticate."
        : "Not required for local development unless scheduler delivery is being tested.",
  });

  signals.push({
    key: "brevo",
    label: "Email/SMS provider",
    level: deployed && !isConfigured(env.BREVO_API_KEY) ? "warning" : "ok",
    detail: isConfigured(env.BREVO_API_KEY)
      ? "Brevo API access is configured."
      : "Brevo API access is missing; customer notification delivery is not operational.",
  });

  const stripeConfigured = isConfigured(env.STRIPE_SECRET_KEY) && isConfigured(env.STRIPE_WEBHOOK_SECRET);
  signals.push({
    key: "stripe",
    label: "Stripe billing/webhook",
    level: deployed && !stripeConfigured ? "critical" : "ok",
    detail: stripeConfigured
      ? "Stripe secret and webhook secret are configured."
      : "Stripe secret and/or webhook secret is missing.",
  });

  return signals;
}

export async function getAdminOperationsHealth() {
  const configSignals = getOperationsConfigSignals();
  const sql = getSql();

  if (!sql) {
    return {
      databaseConnected: false,
      configSignals,
      dataSignals: [
        {
          key: "database",
          label: "Database connectivity",
          level: "critical" as const,
          detail: "No database connection is configured for this runtime.",
        },
      ],
      snapshot: null,
    };
  }

  try {
    const rows = await sql`
      select
        current_user as db_role,
        coalesce((select rolbypassrls from pg_roles where rolname = current_user), false) as role_bypasses_rls,
        (
          select count(*)
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relkind = 'r'
            and c.relrowsecurity
        ) as rls_tables,
        (
          select count(*)
          from pg_constraint
          where convalidated
            and conname in (
              'booking_reminders_booking_ws_fk',
              'bookings_customer_ws_fk',
              'bookings_staff_ws_fk',
              'customer_events_customer_ws_fk',
              'customer_events_booking_ws_fk',
              'staff_schedules_staff_ws_fk',
              'staff_time_off_staff_ws_fk',
              'quote_offers_request_ws_fk',
              'service_jobs_quote_request_ws_fk',
              'service_jobs_quote_offer_ws_fk',
              'job_attachments_job_ws_fk',
              'job_events_job_ws_fk',
              'job_notes_job_ws_fk',
              'job_payments_job_ws_fk',
              'job_evidence_job_ws_fk',
              'job_evidence_attachment_ws_fk',
              'website_reviews_invitation_ws_fk'
            )
        ) as tenant_constraints,
        (
          select count(*)
          from booking_reminder_deliveries
          where status = 'failed'
            and coalesce(attempted_at, updated_at) >= now() - interval '24 hours'
        ) as reminder_failed_24h,
        (
          select count(*)
          from booking_reminder_deliveries
          where status = 'pending'
            and scheduled_for < now() - interval '15 minutes'
        ) as reminder_overdue,
        (
          select count(*)
          from workspace_quote_offer_email_deliveries
          where status = 'failed'
            and requested_at >= now() - interval '24 hours'
        ) as offer_email_failed_24h,
        (
          select count(*)
          from workspace_quote_offer_email_deliveries
          where status = 'pending'
            and requested_at < now() - interval '15 minutes'
        ) as offer_email_stale_pending,
        (
          select count(*)
          from workspace_billing_subscriptions
          where status = 'past_due'
        ) as billing_past_due,
        (
          (select count(*) from workspace_settings where workspace_id = 'default')
          + (select count(*) from workspace_services where workspace_id = 'default')
        ) as legacy_default_workspace_rows
    `;

    const row = rows[0] ?? {};
    const tenantConstraints = toNumber(row.tenant_constraints);
    const reminderFailed = toNumber(row.reminder_failed_24h);
    const reminderOverdue = toNumber(row.reminder_overdue);
    const emailFailed = toNumber(row.offer_email_failed_24h);
    const emailStale = toNumber(row.offer_email_stale_pending);
    const pastDue = toNumber(row.billing_past_due);
    const legacyDefaultRows = toNumber(row.legacy_default_workspace_rows);
    const rlsTables = toNumber(row.rls_tables);
    const roleBypassesRls = Boolean(row.role_bypasses_rls);

    const dataSignals: OperationsHealthSignal[] = [
      {
        key: "database",
        label: "Database connectivity",
        level: "ok",
        detail: `Connected as ${String(row.db_role ?? "unknown")}.`,
      },
      {
        key: "tenant_constraints",
        label: "Tenant relation constraints",
        level: tenantConstraints === expectedTenantConstraintCount ? "ok" : "critical",
        detail: `${tenantConstraints}/${expectedTenantConstraintCount} validated tenant-aware constraints are active.`,
      },
      {
        key: "rls_posture",
        label: "Database RLS posture",
        level: roleBypassesRls || rlsTables === 0 ? "warning" : "ok",
        detail: roleBypassesRls
          ? `Runtime role can bypass RLS; ${rlsTables} public tables currently have RLS enabled. Composite tenant constraints remain required defense-in-depth.`
          : `${rlsTables} public tables have RLS enabled and the runtime role does not bypass it.`,
      },
      {
        key: "reminder_failures",
        label: "Reminder delivery failures",
        level: reminderFailed > 0 ? "warning" : "ok",
        detail: `${reminderFailed} failed reminder deliveries in the last 24 hours.`,
      },
      {
        key: "reminder_overdue",
        label: "Overdue reminder queue",
        level: reminderOverdue > 0 ? "critical" : "ok",
        detail: `${reminderOverdue} pending reminders are more than 15 minutes overdue.`,
      },
      {
        key: "offer_email_failures",
        label: "Offer email failures",
        level: emailFailed > 0 ? "warning" : "ok",
        detail: `${emailFailed} failed offer emails in the last 24 hours.`,
      },
      {
        key: "offer_email_stale",
        label: "Stale offer email queue",
        level: emailStale > 0 ? "critical" : "ok",
        detail: `${emailStale} offer email deliveries have been pending for more than 15 minutes.`,
      },
      {
        key: "billing_past_due",
        label: "Past-due subscriptions",
        level: pastDue > 0 ? "warning" : "ok",
        detail: `${pastDue} Workspace subscriptions are currently past due.`,
      },
      {
        key: "legacy_workspace_rows",
        label: "Legacy default Workspace rows",
        level: legacyDefaultRows > 0 ? "warning" : "ok",
        detail: `${legacyDefaultRows} legacy rows still use workspace_id='default' and block full UUID normalization.`,
      },
    ];

    return {
      databaseConnected: true,
      configSignals,
      dataSignals,
      snapshot: {
        dbRole: String(row.db_role ?? "unknown"),
        roleBypassesRls,
        rlsTables,
        tenantConstraints,
        reminderFailed,
        reminderOverdue,
        emailFailed,
        emailStale,
        pastDue,
        legacyDefaultRows,
      },
    };
  } catch (error) {
    console.error("Failed to read admin operations health", error);
    return {
      databaseConnected: false,
      configSignals,
      dataSignals: [
        {
          key: "database_query",
          label: "Database health query",
          level: "critical" as const,
          detail: "The operations health query failed. Check runtime logs and database availability.",
        },
      ],
      snapshot: null,
    };
  }
}
