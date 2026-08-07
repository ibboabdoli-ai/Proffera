import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type Stripe from "stripe";

import { getSql } from "@/lib/db/server";
import { canCreateServiceJobPayment } from "@/lib/service-job-payment-policy";
import { hasWorkspaceFeature } from "@/lib/workspace-entitlements";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { getWorkspacePaymentAccount } from "@/lib/workspace-payments-db";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type PayableServiceJob = {
  id: string;
  title: string;
  customerName: string;
  status: string;
  totalMinor: number;
  currency: string;
  paymentStatus: string;
};

export async function getPayableWorkspaceServiceJobs(workspaceId: string): Promise<PayableServiceJob[]> {
  const sql = getSql();
  if (!sql) return [];
  const rows = await sql`
    select
      job.id,
      job.title,
      coalesce(customer.name, '') as customer_name,
      job.status,
      job.total_minor,
      job.currency,
      coalesce(payment.status, '') as payment_status
    from workspace_service_jobs job
    left join customers customer
      on customer.id = job.customer_id
     and customer.workspace_id = job.workspace_id::text
    left join workspace_service_job_payments payment
      on payment.workspace_id = job.workspace_id
     and payment.service_job_id = job.id
    where job.workspace_id = ${workspaceId}::uuid
      and job.status <> 'cancelled'
      and job.total_minor is not null
      and job.total_minor > 0
      and job.currency ~ '^[A-Z]{3}$'
    order by case when payment.status = 'paid' then 1 else 0 end, job.updated_at desc
    limit 50
  `;
  return rows.map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    customerName: String(row.customer_name ?? ""),
    status: String(row.status ?? ""),
    totalMinor: Number(row.total_minor),
    currency: String(row.currency ?? ""),
    paymentStatus: String(row.payment_status ?? ""),
  }));
}

export async function createWorkspaceServiceJobPaymentLink(jobId: string, origin: string) {
  if (!uuidPattern.test(jobId)) throw new Error("invalid_job");
  const sql = getSql();
  const access = await getUserWorkspaceAccess();
  if (!sql || !access.ok || !canManageWorkspaceSettings(access)) throw new Error("forbidden");
  if (!(await hasWorkspaceFeature("payments"))) throw new Error("locked");

  const account = await getWorkspacePaymentAccount(access.workspaceId);
  if (!account?.ready) throw new Error("connect_not_ready");

  const jobs = await sql`
    select id, status, total_minor, currency
    from workspace_service_jobs
    where id = ${jobId}::uuid
      and workspace_id = ${access.workspaceId}::uuid
    limit 1
  `;
  const job = jobs[0];
  const totalMinor = job?.total_minor === null || job?.total_minor === undefined ? null : Number(job.total_minor);
  const currency = String(job?.currency ?? "");
  if (!job || !canCreateServiceJobPayment({ status: String(job.status), totalMinor, currency })) throw new Error("not_payable");

  const existing = await sql`
    select status
    from workspace_service_job_payments
    where workspace_id = ${access.workspaceId}::uuid
      and service_job_id = ${jobId}::uuid
    limit 1
  `;
  if (String(existing[0]?.status ?? "") === "paid") throw new Error("already_paid");

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  await sql`
    insert into workspace_service_job_payments (
      workspace_id, service_job_id, token_hash, status, amount_minor, currency, stripe_checkout_session_id, stripe_payment_intent_id, paid_at, created_at, updated_at
    ) values (
      ${access.workspaceId}::uuid, ${jobId}::uuid, ${tokenHash}, 'pending', ${totalMinor}, ${currency}, null, null, null, now(), now()
    )
    on conflict (workspace_id, service_job_id) do update set
      token_hash = excluded.token_hash,
      status = 'pending',
      amount_minor = excluded.amount_minor,
      currency = excluded.currency,
      stripe_checkout_session_id = null,
      stripe_payment_intent_id = null,
      paid_at = null,
      updated_at = now()
    where workspace_service_job_payments.status <> 'paid'
  `;

  await sql`
    insert into workspace_service_job_events (
      workspace_id, service_job_id, event_type, summary, metadata, actor_user_id
    ) values (
      ${access.workspaceId}::uuid,
      ${jobId}::uuid,
      'payment_link_created',
      'Customer payment link created.',
      jsonb_build_object('amount_minor', ${totalMinor}, 'currency', ${currency}),
      ${access.userId}
    )
  `;

  return `${origin.replace(/\/$/, "")}/betala/${rawToken}`;
}

export async function getPublicServiceJobPayment(rawToken: string) {
  if (!rawToken || rawToken.length > 200) return null;
  const sql = getSql();
  if (!sql) return null;
  const tokenHash = hashToken(rawToken);
  const rows = await sql`
    select
      payment.id,
      payment.workspace_id,
      payment.service_job_id,
      payment.status,
      payment.amount_minor,
      payment.currency,
      payment.stripe_checkout_session_id,
      job.title,
      coalesce(settings.company_name, 'Proffera') as company_name,
      account.stripe_account_id,
      account.charges_enabled,
      account.payouts_enabled
    from workspace_service_job_payments payment
    join workspace_service_jobs job
      on job.id = payment.service_job_id
     and job.workspace_id = payment.workspace_id
    join workspace_payment_accounts account
      on account.workspace_id = payment.workspace_id
    left join workspace_settings settings
      on settings.workspace_id = payment.workspace_id
    where payment.token_hash = ${tokenHash}
      and payment.status in ('pending', 'paid')
    limit 1
  `;
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    serviceJobId: String(row.service_job_id),
    status: String(row.status),
    amountMinor: Number(row.amount_minor),
    currency: String(row.currency),
    checkoutSessionId: String(row.stripe_checkout_session_id ?? ""),
    title: String(row.title ?? ""),
    companyName: String(row.company_name ?? "Proffera"),
    stripeAccountId: String(row.stripe_account_id ?? ""),
    accountReady: Boolean(row.charges_enabled) && Boolean(row.payouts_enabled),
  };
}

export async function bindServiceJobCheckoutSession(paymentId: string, sessionId: string) {
  if (!uuidPattern.test(paymentId)) throw new Error("invalid_payment");
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");
  await sql`
    update workspace_service_job_payments
    set stripe_checkout_session_id = ${sessionId}, updated_at = now()
    where id = ${paymentId}::uuid
      and status = 'pending'
  `;
}

export async function applyServiceJobCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.metadata?.payment_kind !== "service_job" || session.payment_status !== "paid") return false;
  const paymentId = session.metadata.payment_request_id ?? "";
  const workspaceId = session.metadata.workspace_id ?? "";
  const serviceJobId = session.metadata.service_job_id ?? "";
  if (!uuidPattern.test(paymentId) || !uuidPattern.test(workspaceId) || !uuidPattern.test(serviceJobId)) return false;
  const sql = getSql();
  if (!sql) throw new Error("database_unavailable");
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const rows = await sql`
    update workspace_service_job_payments
    set
      status = 'paid',
      stripe_checkout_session_id = ${session.id},
      stripe_payment_intent_id = ${paymentIntentId},
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
    where id = ${paymentId}::uuid
      and workspace_id = ${workspaceId}::uuid
      and service_job_id = ${serviceJobId}::uuid
      and status = 'pending'
      and amount_minor = ${session.amount_total ?? -1}
      and lower(currency) = lower(${session.currency ?? ""})
    returning id
  `;
  if (!rows[0]) return false;
  await sql`
    insert into workspace_service_job_events (
      workspace_id, service_job_id, event_type, summary, metadata
    ) values (
      ${workspaceId}::uuid,
      ${serviceJobId}::uuid,
      'payment_paid',
      'Customer payment completed.',
      jsonb_build_object('checkout_session_id', ${session.id}, 'payment_intent_id', ${paymentIntentId})
    )
  `;
  return true;
}
