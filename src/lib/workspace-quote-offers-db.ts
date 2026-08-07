import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

import type { WorkspaceBillingCurrency } from "@/lib/workspace-market";
import type { NormalizedWorkspaceQuoteOfferDraft } from "@/lib/workspace-quote-offer-draft";
import { canEditWorkspaceQuoteOffer, type WorkspaceQuoteOfferStatus } from "@/lib/workspace-quote-offer-policy";
import {
  createPublicWorkspaceQuoteOfferToken,
  hashPublicWorkspaceQuoteOfferToken,
  isPublicWorkspaceQuoteOfferToken,
} from "@/lib/workspace-quote-offer-public";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  resolveDatabaseUrl();

function getSqlClient() {
  return connectionString ? neon(connectionString) : null;
}

type SqlClient = NonNullable<ReturnType<typeof getSqlClient>>;

async function getActiveWorkspaceId() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok) throw new Error("A valid workspace membership is required for quote offers");
  return access.workspaceId;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export const workspaceQuoteOfferEmailDeliveryStatuses = ["not_sent", "pending", "sent", "failed"] as const;

export type WorkspaceQuoteOfferEmailDeliveryStatus = (typeof workspaceQuoteOfferEmailDeliveryStatuses)[number];

function mapEmailDeliveryStatus(value: unknown): WorkspaceQuoteOfferEmailDeliveryStatus {
  const status = text(value);
  return workspaceQuoteOfferEmailDeliveryStatuses.includes(status as WorkspaceQuoteOfferEmailDeliveryStatus)
    ? status as WorkspaceQuoteOfferEmailDeliveryStatus
    : "not_sent";
}

export type DashboardWorkspaceQuoteOffer = {
  id: string;
  quoteRequestId: string;
  version: number;
  status: WorkspaceQuoteOfferStatus;
  currency: WorkspaceBillingCurrency;
  subtotalMinor: number;
  vatRateBasisPoints: number;
  vatAmountMinor: number;
  totalMinor: number;
  title: string;
  terms: string;
  validUntil: string;
  sentAt: string;
  acceptedAt: string;
  rejectedAt: string;
  publicTokenExpiresAt: string;
  firstViewedAt: string;
  responseAt: string;
  emailDeliveryStatus: WorkspaceQuoteOfferEmailDeliveryStatus;
  emailDeliveryAttempt: number;
  emailDeliveryRequestedAt: string;
  emailDeliveryCompletedAt: string;
  emailDeliveryFailureCode: string;
  createdAt: string;
  updatedAt: string;
};

function mapOffer(row: Record<string, unknown>): DashboardWorkspaceQuoteOffer {
  return {
    id: text(row.id),
    quoteRequestId: text(row.quote_request_id),
    version: Number(row.version),
    status: text(row.status) as WorkspaceQuoteOfferStatus,
    currency: text(row.currency) as WorkspaceBillingCurrency,
    subtotalMinor: Number(row.subtotal_minor),
    vatRateBasisPoints: Number(row.vat_rate_basis_points),
    vatAmountMinor: Number(row.vat_amount_minor),
    totalMinor: Number(row.total_minor),
    title: text(row.title),
    terms: text(row.terms),
    validUntil: text(row.valid_until),
    sentAt: text(row.sent_at),
    acceptedAt: text(row.accepted_at),
    rejectedAt: text(row.rejected_at),
    publicTokenExpiresAt: text(row.public_token_expires_at),
    firstViewedAt: text(row.first_viewed_at),
    responseAt: text(row.response_at),
    emailDeliveryStatus: mapEmailDeliveryStatus(row.email_delivery_status),
    emailDeliveryAttempt: Number(row.email_delivery_attempt ?? 0),
    emailDeliveryRequestedAt: text(row.email_delivery_requested_at),
    emailDeliveryCompletedAt: text(row.email_delivery_completed_at),
    emailDeliveryFailureCode: text(row.email_delivery_failure_code),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export async function getDashboardWorkspaceQuoteOffers(quoteRequestId: string) {
  const sql = getSqlClient();
  if (!sql) return [];
  const workspaceId = await getActiveWorkspaceId();
  const rows = await sql`
    select offer.id, offer.quote_request_id, offer.version, offer.status, offer.currency, offer.subtotal_minor,
           offer.vat_rate_basis_points, offer.vat_amount_minor, offer.total_minor, offer.title, offer.terms,
           offer.valid_until, offer.sent_at, offer.accepted_at, offer.rejected_at, offer.public_token_expires_at,
           offer.first_viewed_at, offer.response_at, offer.created_at, offer.updated_at,
           delivery.status as email_delivery_status,
           delivery.attempt as email_delivery_attempt,
           delivery.requested_at as email_delivery_requested_at,
           delivery.completed_at as email_delivery_completed_at,
           delivery.failure_code as email_delivery_failure_code
    from workspace_quote_offers offer
    left join lateral (
      select status, attempt, requested_at, completed_at, failure_code
      from workspace_quote_offer_email_deliveries
      where workspace_id = offer.workspace_id
        and quote_offer_id = offer.id
      order by attempt desc
      limit 1
    ) delivery on true
    where offer.workspace_id = ${workspaceId}
      and offer.quote_request_id = ${quoteRequestId}
    order by offer.version desc
  `;
  return rows.map((row) => mapOffer(row as Record<string, unknown>));
}

export async function getDashboardWorkspaceQuoteOffer(quoteRequestId: string, offerId: string) {
  const sql = getSqlClient();
  if (!sql) return null;
  const workspaceId = await getActiveWorkspaceId();
  const rows = await sql`
    select offer.id, offer.quote_request_id, offer.version, offer.status, offer.currency, offer.subtotal_minor,
           offer.vat_rate_basis_points, offer.vat_amount_minor, offer.total_minor, offer.title, offer.terms,
           offer.valid_until, offer.sent_at, offer.accepted_at, offer.rejected_at, offer.public_token_expires_at,
           offer.first_viewed_at, offer.response_at, offer.created_at, offer.updated_at,
           delivery.status as email_delivery_status,
           delivery.attempt as email_delivery_attempt,
           delivery.requested_at as email_delivery_requested_at,
           delivery.completed_at as email_delivery_completed_at,
           delivery.failure_code as email_delivery_failure_code
    from workspace_quote_offers offer
    left join lateral (
      select status, attempt, requested_at, completed_at, failure_code
      from workspace_quote_offer_email_deliveries
      where workspace_id = offer.workspace_id
        and quote_offer_id = offer.id
      order by attempt desc
      limit 1
    ) delivery on true
    where offer.workspace_id = ${workspaceId}
      and offer.quote_request_id = ${quoteRequestId}
      and offer.id = ${offerId}
    limit 1
  `;
  return rows[0] ? mapOffer(rows[0] as Record<string, unknown>) : null;
}

async function insertDraft(
  sql: SqlClient,
  workspaceId: string,
  quoteRequestId: string,
  draft: NormalizedWorkspaceQuoteOfferDraft,
) {
  return sql`
    insert into workspace_quote_offers (
      workspace_id, quote_request_id, version, status, currency,
      subtotal_minor, vat_rate_basis_points, vat_amount_minor, total_minor,
      title, terms, valid_until
    )
    select
      q.workspace_id,
      q.id,
      coalesce((
        select max(existing.version)
        from workspace_quote_offers existing
        where existing.workspace_id = q.workspace_id
          and existing.quote_request_id = q.id
      ), 0) + 1,
      'draft',
      ${draft.currency},
      ${draft.subtotalMinor},
      ${draft.vatRateBasisPoints},
      ${draft.vatAmountMinor},
      ${draft.totalMinor},
      ${draft.title},
      ${draft.terms},
      ${draft.validUntil}
    from workspace_quote_requests q
    join workspace_settings settings
      on settings.workspace_id = q.workspace_id::text
     and settings.billing_currency = ${draft.currency}
    where q.id = ${quoteRequestId}
      and q.workspace_id = ${workspaceId}
      and q.status in ('submitted', 'reviewing')
    returning id, version
  `;
}

export async function createDashboardWorkspaceQuoteOfferDraft(
  quoteRequestId: string,
  draft: NormalizedWorkspaceQuoteOfferDraft,
) {
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for quote offer creation");
  const workspaceId = await getActiveWorkspaceId();

  let rows;
  try {
    rows = await insertDraft(sql, workspaceId, quoteRequestId, draft);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "23505") throw error;
    rows = await insertDraft(sql, workspaceId, quoteRequestId, draft);
  }

  if (!rows[0]) {
    throw new Error("Quote request or workspace billing currency was not valid for a draft offer");
  }

  await sql`
    update workspace_quote_requests
    set status = 'reviewing', updated_at = now()
    where id = ${quoteRequestId}
      and workspace_id = ${workspaceId}
      and status = 'submitted'
  `;

  return { id: String(rows[0].id), version: Number(rows[0].version) };
}

export async function updateDashboardWorkspaceQuoteOfferDraft(
  quoteRequestId: string,
  offerId: string,
  expectedUpdatedAt: string,
  draft: NormalizedWorkspaceQuoteOfferDraft,
) {
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for quote offer update");
  const workspaceId = await getActiveWorkspaceId();

  const currentRows = await sql`
    select status, currency
    from workspace_quote_offers
    where workspace_id = ${workspaceId}
      and quote_request_id = ${quoteRequestId}
      and id = ${offerId}
    limit 1
  `;
  const current = currentRows[0];
  if (!current) throw new Error("Quote offer was not found for the active workspace");
  const status = String(current.status) as WorkspaceQuoteOfferStatus;
  if (!canEditWorkspaceQuoteOffer(status)) throw new Error("Only draft offers can be edited");
  if (String(current.currency) !== draft.currency) throw new Error("Offer currency cannot be changed");

  const rows = await sql`
    update workspace_quote_offers
    set subtotal_minor = ${draft.subtotalMinor},
        vat_rate_basis_points = ${draft.vatRateBasisPoints},
        vat_amount_minor = ${draft.vatAmountMinor},
        total_minor = ${draft.totalMinor},
        title = ${draft.title},
        terms = ${draft.terms},
        valid_until = ${draft.validUntil},
        updated_at = now()
    where workspace_id = ${workspaceId}
      and quote_request_id = ${quoteRequestId}
      and id = ${offerId}
      and status = 'draft'
      and updated_at = ${expectedUpdatedAt}
    returning id, updated_at
  `;

  if (!rows[0]) throw new Error("The draft changed before the update completed");
  return { id: String(rows[0].id), updatedAt: String(rows[0].updated_at) };
}

export type DashboardWorkspaceQuoteOfferEmailDeliveryMode = "initial" | "resend";

export type PreparedDashboardWorkspaceQuoteOfferEmailDelivery = {
  token: string;
  tokenHash: string;
  expiresAt: string;
  attempt: number;
  customerName: string;
  customerEmail: string;
  companyName: string;
  quoteReferenceId: string;
  currency: WorkspaceBillingCurrency;
  subtotalMinor: number;
  vatRateBasisPoints: number;
  vatAmountMinor: number;
  totalMinor: number;
  title: string;
  terms: string;
  validUntil: string;
  sentAt: string;
};

export async function prepareDashboardWorkspaceQuoteOfferEmailDelivery(
  quoteRequestId: string,
  offerId: string,
  mode: DashboardWorkspaceQuoteOfferEmailDeliveryMode,
): Promise<PreparedDashboardWorkspaceQuoteOfferEmailDelivery> {
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for quote offer delivery");
  const workspaceId = await getActiveWorkspaceId();
  const token = createPublicWorkspaceQuoteOfferToken();
  const tokenHash = hashPublicWorkspaceQuoteOfferToken(token);

  const [, , rows] = await sql.transaction((transaction) => [
    transaction`
    with prepared_offer as (
      update workspace_quote_offers offer
      set
        status = case when ${mode} = 'initial' then 'sent' else offer.status end,
        sent_at = case when ${mode} = 'initial' then now() else offer.sent_at end,
        public_token_hash = ${tokenHash},
        public_token_expires_at = coalesce(
          (offer.valid_until + 1)::timestamptz,
          now() + interval '30 days'
        ),
        email_delivery_attempts = offer.email_delivery_attempts + 1,
        updated_at = now()
      from workspace_quote_requests request
      where offer.id = ${offerId}
        and offer.quote_request_id = ${quoteRequestId}
        and offer.workspace_id = ${workspaceId}
        and request.id = offer.quote_request_id
        and request.workspace_id = offer.workspace_id
        and nullif(trim(request.customer_email), '') is not null
        and (
          (${mode} = 'initial' and offer.status = 'draft' and request.status in ('submitted', 'reviewing'))
          or (${mode} = 'resend' and offer.status = 'sent' and request.status = 'quoted')
        )
      returning
        offer.id as offer_id,
        offer.workspace_id,
        offer.quote_request_id
    )
    update workspace_quote_requests request
    set status = 'quoted', updated_at = now()
    from prepared_offer offer
    where ${mode} = 'initial'
      and request.id = offer.quote_request_id
      and request.workspace_id = offer.workspace_id
      and request.status in ('submitted', 'reviewing')
    returning request.id
  `,
    transaction`
    update workspace_quote_offer_email_deliveries delivery
    set status = 'failed', failure_code = 'superseded', completed_at = now()
    where delivery.workspace_id = ${workspaceId}
      and delivery.quote_offer_id = ${offerId}
      and delivery.status = 'pending'
    returning delivery.id
  `,
    transaction`
    with created_delivery as (
      insert into workspace_quote_offer_email_deliveries (
        workspace_id,
        quote_offer_id,
        attempt,
        status
      )
      select offer.workspace_id, offer.id, offer.email_delivery_attempts, 'pending'
      from workspace_quote_offers offer
      join workspace_quote_requests request
        on request.id = offer.quote_request_id
       and request.workspace_id = offer.workspace_id
      where offer.id = ${offerId}
        and offer.quote_request_id = ${quoteRequestId}
        and offer.workspace_id = ${workspaceId}
        and offer.public_token_hash = ${tokenHash}
        and offer.status = 'sent'
        and request.status = 'quoted'
        and nullif(trim(request.customer_email), '') is not null
      returning workspace_id, quote_offer_id, attempt
    )
    select
      offer.public_token_hash,
      offer.public_token_expires_at,
      offer.email_delivery_attempts,
      offer.currency,
      offer.subtotal_minor,
      offer.vat_rate_basis_points,
      offer.vat_amount_minor,
      offer.total_minor,
      offer.title,
      offer.terms,
      offer.valid_until,
      offer.sent_at,
      request.reference_id,
      request.customer_name,
      request.customer_email,
      coalesce(nullif(workspace.company_name, ''), workspace.name) as company_name,
      delivery.attempt
    from workspace_quote_offers offer
    join workspace_quote_requests request
      on request.id = offer.quote_request_id
     and request.workspace_id = offer.workspace_id
    join workspaces workspace on workspace.id = offer.workspace_id
    join created_delivery delivery
      on delivery.workspace_id = offer.workspace_id
     and delivery.quote_offer_id = offer.id
     and delivery.attempt = offer.email_delivery_attempts
    where offer.id = ${offerId}
      and offer.quote_request_id = ${quoteRequestId}
      and offer.workspace_id = ${workspaceId}
      and offer.public_token_hash = ${tokenHash}
  `,
  ]);

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row?.public_token_expires_at || !row.public_token_hash) {
    throw new Error("Quote offer could not be prepared for email delivery");
  }

  return {
    token,
    tokenHash: text(row.public_token_hash),
    expiresAt: text(row.public_token_expires_at),
    attempt: Number(row.attempt),
    customerName: text(row.customer_name),
    customerEmail: text(row.customer_email),
    companyName: text(row.company_name),
    quoteReferenceId: text(row.reference_id),
    currency: text(row.currency) as WorkspaceBillingCurrency,
    subtotalMinor: Number(row.subtotal_minor),
    vatRateBasisPoints: Number(row.vat_rate_basis_points),
    vatAmountMinor: Number(row.vat_amount_minor),
    totalMinor: Number(row.total_minor),
    title: text(row.title),
    terms: text(row.terms),
    validUntil: text(row.valid_until),
    sentAt: text(row.sent_at),
  };
}

export type DashboardWorkspaceQuoteOfferEmailDeliveryCompletion =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "failed"; failureCode: "configuration" | "provider" | "network" | "rendering" };

export async function completeDashboardWorkspaceQuoteOfferEmailDelivery(
  offerId: string,
  attempt: number,
  tokenHash: string,
  completion: DashboardWorkspaceQuoteOfferEmailDeliveryCompletion,
) {
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for quote offer email completion");
  const workspaceId = await getActiveWorkspaceId();
  const providerMessageId = completion.status === "sent"
    ? completion.providerMessageId?.slice(0, 512) ?? null
    : null;
  const failureCode = completion.status === "failed" ? completion.failureCode : null;

  const rows = await sql`
    update workspace_quote_offer_email_deliveries delivery
    set
      status = ${completion.status},
      provider_message_id = ${providerMessageId},
      failure_code = ${failureCode},
      completed_at = now()
    from workspace_quote_offers offer
    where delivery.workspace_id = ${workspaceId}
      and delivery.quote_offer_id = ${offerId}
      and delivery.attempt = ${attempt}
      and delivery.status = 'pending'
      and offer.id = delivery.quote_offer_id
      and offer.workspace_id = delivery.workspace_id
      and offer.public_token_hash = ${tokenHash}
    returning delivery.id
  `;

  return Boolean(rows[0]);
}

export type PublicWorkspaceQuoteOffer = {
  status: Extract<WorkspaceQuoteOfferStatus, "sent" | "accepted" | "rejected">;
  companyName: string;
  quoteReferenceId: string;
  customerName: string;
  currency: WorkspaceBillingCurrency;
  subtotalMinor: number;
  vatRateBasisPoints: number;
  vatAmountMinor: number;
  totalMinor: number;
  title: string;
  terms: string;
  validUntil: string;
  publicTokenExpiresAt: string;
  sentAt: string;
  acceptedAt: string;
  rejectedAt: string;
  responseAt: string;
};

function mapPublicOffer(row: Record<string, unknown>): PublicWorkspaceQuoteOffer {
  return {
    status: text(row.status) as PublicWorkspaceQuoteOffer["status"],
    companyName: text(row.company_name),
    quoteReferenceId: text(row.reference_id),
    customerName: text(row.customer_name),
    currency: text(row.currency) as WorkspaceBillingCurrency,
    subtotalMinor: Number(row.subtotal_minor),
    vatRateBasisPoints: Number(row.vat_rate_basis_points),
    vatAmountMinor: Number(row.vat_amount_minor),
    totalMinor: Number(row.total_minor),
    title: text(row.title),
    terms: text(row.terms),
    validUntil: text(row.valid_until),
    publicTokenExpiresAt: text(row.public_token_expires_at),
    sentAt: text(row.sent_at),
    acceptedAt: text(row.accepted_at),
    rejectedAt: text(row.rejected_at),
    responseAt: text(row.response_at),
  };
}

export async function getPublicWorkspaceQuoteOffer(token: string) {
  if (!isPublicWorkspaceQuoteOfferToken(token)) return null;
  const sql = getSqlClient();
  if (!sql) return null;
  const tokenHash = hashPublicWorkspaceQuoteOfferToken(token);

  const rows = await sql`
    with visible_offer as (
      select offer.id
      from workspace_quote_offers offer
      join workspace_quote_requests request
        on request.id = offer.quote_request_id
       and request.workspace_id = offer.workspace_id
      where offer.public_token_hash = ${tokenHash}
        and offer.public_token_expires_at > now()
        and (offer.valid_until is null or offer.valid_until >= current_date)
        and (
          (offer.status = 'sent' and request.status = 'quoted')
          or (offer.status = 'accepted' and request.status = 'accepted')
          or (offer.status = 'rejected' and request.status = 'rejected')
        )
      limit 1
    ),
    mark_first_view as (
      update workspace_quote_offers offer
      set first_viewed_at = coalesce(offer.first_viewed_at, now())
      where offer.id in (select id from visible_offer)
        and offer.status = 'sent'
      returning offer.id
    )
    select
      offer.status,
      coalesce(nullif(workspace.company_name, ''), workspace.name) as company_name,
      request.reference_id,
      request.customer_name,
      offer.currency,
      offer.subtotal_minor,
      offer.vat_rate_basis_points,
      offer.vat_amount_minor,
      offer.total_minor,
      offer.title,
      offer.terms,
      offer.valid_until,
      offer.public_token_expires_at,
      offer.sent_at,
      offer.accepted_at,
      offer.rejected_at,
      offer.response_at
    from workspace_quote_offers offer
    join visible_offer visible on visible.id = offer.id
    join workspace_quote_requests request
      on request.id = offer.quote_request_id
     and request.workspace_id = offer.workspace_id
    join workspaces workspace on workspace.id = offer.workspace_id
    limit 1
  `;

  return rows[0] ? mapPublicOffer(rows[0] as Record<string, unknown>) : null;
}

export type PublicWorkspaceQuoteOfferResponse = "accepted" | "rejected";

export async function respondToPublicWorkspaceQuoteOffer(
  token: string,
  response: PublicWorkspaceQuoteOfferResponse,
) {
  if (!isPublicWorkspaceQuoteOfferToken(token)) return { ok: false as const };
  const sql = getSqlClient();
  if (!sql) return { ok: false as const };
  const tokenHash = hashPublicWorkspaceQuoteOfferToken(token);

  const rows = await sql`
    with responded_offer as (
      update workspace_quote_offers offer
      set
        status = ${response},
        accepted_at = case when ${response} = 'accepted' then now() else offer.accepted_at end,
        rejected_at = case when ${response} = 'rejected' then now() else offer.rejected_at end,
        response_at = now(),
        updated_at = now()
      from workspace_quote_requests request
      where offer.public_token_hash = ${tokenHash}
        and offer.status = 'sent'
        and offer.public_token_expires_at > now()
        and (offer.valid_until is null or offer.valid_until >= current_date)
        and request.id = offer.quote_request_id
        and request.workspace_id = offer.workspace_id
        and request.status = 'quoted'
      returning
        offer.id as offer_id,
        offer.quote_request_id,
        offer.workspace_id,
        offer.title,
        offer.currency,
        offer.total_minor
    )
    , responded_request as (
      update workspace_quote_requests request
      set status = ${response}, updated_at = now()
      from responded_offer offer
      where request.id = offer.quote_request_id
        and request.workspace_id = offer.workspace_id
        and request.status = 'quoted'
      returning
        request.id,
        request.workspace_id,
        request.customer_name,
        request.customer_email,
        request.customer_phone,
        request.city,
        request.description
    )
    , existing_customer as (
      select customer.id
      from customers customer
      join responded_request request
        on customer.workspace_id = request.workspace_id::text
       and lower(customer.email) = lower(request.customer_email)
      where ${response} = 'accepted'
        and nullif(trim(request.customer_email), '') is not null
      order by customer.created_at asc
      limit 1
    )
    , created_customer as (
      insert into customers (
        workspace_id,
        name,
        email,
        phone,
        city,
        status,
        source
      )
      select
        request.workspace_id::text,
        request.customer_name,
        request.customer_email,
        nullif(trim(request.customer_phone), ''),
        nullif(trim(request.city), ''),
        'active',
        'quote_offer'
      from responded_request request
      where ${response} = 'accepted'
        and not exists (select 1 from existing_customer)
      returning id
    )
    , customer_for_job as (
      select id from existing_customer
      union all
      select id from created_customer
    )
    , created_job as (
      insert into workspace_service_jobs (
        workspace_id,
        source_type,
        quote_request_id,
        quote_offer_id,
        customer_id,
        status,
        title,
        description,
        service_name,
        city,
        currency,
        total_minor
      )
      select
        offer.workspace_id,
        'quote_offer',
        offer.quote_request_id,
        offer.offer_id,
        customer.id,
        'new',
        offer.title,
        request.description,
        offer.title,
        nullif(trim(request.city), ''),
        offer.currency,
        offer.total_minor
      from responded_offer offer
      join responded_request request
        on request.id = offer.quote_request_id
       and request.workspace_id = offer.workspace_id
      join customer_for_job customer on true
      where ${response} = 'accepted'
      on conflict (quote_offer_id) where quote_offer_id is not null do nothing
      returning id, workspace_id, quote_offer_id, customer_id
    )
    , job_event as (
      insert into workspace_service_job_events (
        workspace_id,
        service_job_id,
        event_type,
        to_status,
        summary,
        metadata
      )
      select
        workspace_id,
        id,
        'created',
        'new',
        'Service job created from accepted quote offer.',
        jsonb_build_object('source', 'accepted_quote_offer', 'quote_offer_id', quote_offer_id)
      from created_job
      returning id
    )
    , customer_event as (
      insert into customer_events (
        workspace_id,
        customer_id,
        event_type,
        title,
        description,
        metadata
      )
      select
        request.workspace_id::text,
        job.customer_id,
        'status_change',
        'Quote offer accepted',
        'A service job was created from the accepted quote offer.',
        jsonb_build_object('source', 'accepted_quote_offer', 'service_job_id', job.id, 'quote_offer_id', job.quote_offer_id)
      from created_job job
      join responded_request request on request.workspace_id = job.workspace_id
      returning id
    )
    select id from responded_request
  `;

  return rows[0] ? { ok: true as const, response } : { ok: false as const };
}

export async function getDashboardWorkspaceBillingCurrency() {
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for workspace currency");
  const workspaceId = await getActiveWorkspaceId();
  const rows = await sql`
    select billing_currency
    from workspace_settings
    where workspace_id = ${workspaceId}
    limit 1
  `;
  const currency = rows[0]?.billing_currency ? String(rows[0].billing_currency) : "";
  if (!(["SEK", "EUR", "GBP"] as const).includes(currency as WorkspaceBillingCurrency)) {
    throw new Error("Workspace billing currency is not configured");
  }
  return currency as WorkspaceBillingCurrency;
}
