import "server-only";

import { neon } from "@neondatabase/serverless";

import type { WorkspaceBillingCurrency } from "@/lib/workspace-market";
import type { NormalizedWorkspaceQuoteOfferDraft } from "@/lib/workspace-quote-offer-draft";
import { canEditWorkspaceQuoteOffer, type WorkspaceQuoteOfferStatus } from "@/lib/workspace-quote-offer-policy";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

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
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export async function getDashboardWorkspaceQuoteOffers(quoteRequestId: string) {
  const sql = getSqlClient();
  if (!sql) return [];
  const workspaceId = await getActiveWorkspaceId();
  const rows = await sql`
    select id, quote_request_id, version, status, currency, subtotal_minor,
           vat_rate_basis_points, vat_amount_minor, total_minor, title, terms,
           valid_until, created_at, updated_at
    from workspace_quote_offers
    where workspace_id = ${workspaceId}
      and quote_request_id = ${quoteRequestId}
    order by version desc
  `;
  return rows.map((row) => mapOffer(row as Record<string, unknown>));
}

export async function getDashboardWorkspaceQuoteOffer(quoteRequestId: string, offerId: string) {
  const sql = getSqlClient();
  if (!sql) return null;
  const workspaceId = await getActiveWorkspaceId();
  const rows = await sql`
    select id, quote_request_id, version, status, currency, subtotal_minor,
           vat_rate_basis_points, vat_amount_minor, total_minor, title, terms,
           valid_until, created_at, updated_at
    from workspace_quote_offers
    where workspace_id = ${workspaceId}
      and quote_request_id = ${quoteRequestId}
      and id = ${offerId}
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
