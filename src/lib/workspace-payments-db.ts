import "server-only";

import { getSql } from "@/lib/db/server";
import { getStripeClient } from "@/lib/stripe";

export type WorkspacePaymentAccount = {
  stripeAccountId: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  ready: boolean;
};

function mapAccount(row: Record<string, unknown>): WorkspacePaymentAccount {
  const chargesEnabled = Boolean(row.charges_enabled);
  const payoutsEnabled = Boolean(row.payouts_enabled);
  return {
    stripeAccountId: String(row.stripe_account_id ?? ""),
    detailsSubmitted: Boolean(row.details_submitted),
    chargesEnabled,
    payoutsEnabled,
    ready: chargesEnabled && payoutsEnabled,
  };
}

export async function getWorkspacePaymentAccount(workspaceId: string) {
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`
    select stripe_account_id, details_submitted, charges_enabled, payouts_enabled
    from workspace_payment_accounts
    where workspace_id = ${workspaceId}::uuid
    limit 1
  `;
  return rows[0] ? mapAccount(rows[0] as Record<string, unknown>) : null;
}

export async function ensureWorkspaceStripeConnectAccount(workspaceId: string) {
  const sql = getSql();
  const stripe = getStripeClient();
  if (!sql || !stripe) throw new Error("Stripe Connect is not configured");

  const existing = await getWorkspacePaymentAccount(workspaceId);
  if (existing?.stripeAccountId) return existing.stripeAccountId;

  const account = await stripe.accounts.create({
    type: "express",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { workspace_id: workspaceId },
  });

  try {
    await sql`
      insert into workspace_payment_accounts (
        workspace_id, stripe_account_id, details_submitted, charges_enabled, payouts_enabled, created_at, updated_at
      ) values (
        ${workspaceId}::uuid, ${account.id}, ${account.details_submitted}, ${account.charges_enabled}, ${account.payouts_enabled}, now(), now()
      )
      on conflict (workspace_id) do update set
        stripe_account_id = excluded.stripe_account_id,
        details_submitted = excluded.details_submitted,
        charges_enabled = excluded.charges_enabled,
        payouts_enabled = excluded.payouts_enabled,
        updated_at = now()
    `;
  } catch (error) {
    await stripe.accounts.del(account.id).catch(() => undefined);
    throw error;
  }

  return account.id;
}

export async function syncWorkspaceStripeConnectAccount(workspaceId: string) {
  const sql = getSql();
  const stripe = getStripeClient();
  if (!sql || !stripe) return null;

  const existing = await getWorkspacePaymentAccount(workspaceId);
  if (!existing?.stripeAccountId) return null;

  const account = await stripe.accounts.retrieve(existing.stripeAccountId);
  const rows = await sql`
    update workspace_payment_accounts
    set
      details_submitted = ${account.details_submitted},
      charges_enabled = ${account.charges_enabled},
      payouts_enabled = ${account.payouts_enabled},
      updated_at = now()
    where workspace_id = ${workspaceId}::uuid
      and stripe_account_id = ${account.id}
    returning stripe_account_id, details_submitted, charges_enabled, payouts_enabled
  `;
  return rows[0] ? mapAccount(rows[0] as Record<string, unknown>) : null;
}
