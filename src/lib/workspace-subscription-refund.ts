import "server-only";

import type Stripe from "stripe";

import { getSql } from "@/lib/db/server";
import { getStripeCheckoutPlanForPriceId } from "@/lib/stripe";
import { syncWorkspaceSubscription } from "@/lib/workspace-billing";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idOf(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

/**
 * Cancel only a subscription whose latest paid invoice was fully refunded.
 * All evidence is resolved from Stripe and the currently linked Workspace row.
 * A refund for an older invoice or an unrelated ServiceJob is not actionable.
 */
export async function applyFullSubscriptionRefund(stripe: Stripe, refundedCharge: Stripe.Charge, eventCreated: number) {
  if (!refundedCharge.id || refundedCharge.amount <= 0 || !refundedCharge.refunded ||
      refundedCharge.amount_refunded !== refundedCharge.amount) {
    return { ok: true as const, applied: false };
  }

  // A signed event might describe stale state. Re-read the charge before acting.
  const charge = await stripe.charges.retrieve(refundedCharge.id);
  if (!charge.refunded || charge.amount <= 0 || charge.amount_refunded !== charge.amount ||
      charge.currency !== refundedCharge.currency || charge.livemode !== refundedCharge.livemode) {
    return { ok: true as const, applied: false };
  }

  // A requested refund can still be pending or later fail. Never revoke paid
  // access until successful refunds cover the entire charge.
  const refunds = await stripe.refunds.list({ charge: charge.id, limit: 100 });
  if (refunds.has_more ||
      refunds.data.filter((refund) => refund.status === "succeeded")
        .reduce((total, refund) => total + refund.amount, 0) !== charge.amount) {
    return { ok: true as const, applied: false };
  }

  const paymentIntentId = idOf(charge.payment_intent);
  const customerId = idOf(charge.customer);
  if (!paymentIntentId || !customerId) return { ok: true as const, applied: false };

  const payments = await stripe.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: paymentIntentId },
    limit: 2,
  });
  // A normal one-time ServiceJob charge does not have a subscription invoice.
  if (payments.has_more || payments.data.length !== 1 || payments.data[0]?.status !== "paid") {
    return { ok: true as const, applied: false };
  }
  const invoiceId = idOf(payments.data[0].invoice);
  if (!invoiceId) return { ok: true as const, applied: false };
  const invoice = await stripe.invoices.retrieve(invoiceId);
  const parent = invoice.parent;
  const subscriptionId = parent?.type === "subscription_details"
    ? idOf(parent.subscription_details?.subscription)
    : null;
  if (!subscriptionId || invoice.status !== "paid" ||
      idOf(invoice.customer) !== customerId || invoice.currency !== charge.currency) {
    return { ok: true as const, applied: false };
  }

  // A fully refunded Charge is not proof that all payments on the parent
  // subscription invoice were refunded. Fail closed for invoices containing
  // additional or out-of-band payments; those require explicit reconciliation.
  const invoicePayments = await stripe.invoicePayments.list({ invoice: invoiceId, limit: 100 });
  if (invoicePayments.has_more || invoicePayments.data.length !== 1 ||
      !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid <= 0 ||
      invoice.amount_paid !== charge.amount) {
    return { ok: true as const, applied: false };
  }
  const onlyPayment = invoicePayments.data[0];
  if (onlyPayment.status !== "paid" || onlyPayment.amount_paid !== charge.amount ||
      !onlyPayment.payment || onlyPayment.payment.type !== "payment_intent" ||
      idOf(onlyPayment.payment.payment_intent) !== paymentIntentId) {
    return { ok: true as const, applied: false };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const workspaceId = subscription.metadata.workspace_id?.trim() ?? "";
  const priceId = subscription.items.data[0]?.price.id ?? "";
  const planKey = getStripeCheckoutPlanForPriceId(priceId);
  if (!uuidPattern.test(workspaceId) || !planKey ||
      idOf(subscription.customer) !== customerId ||
      idOf(subscription.latest_invoice) !== invoiceId) {
    return { ok: true as const, applied: false };
  }

  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" as const };
  const rows = await sql`
    select 1 from workspace_billing_subscriptions
    where workspace_id = ${workspaceId}::uuid
      and stripe_subscription_id = ${subscriptionId}
      and stripe_customer_id = ${customerId}
      and stripe_price_id = ${priceId}
    limit 1
  `;
  if (rows.length !== 1) return { ok: true as const, applied: false };

  // A renewal/upgrade may happen while we verify the invoice and Workspace.
  // Re-read immediately before any cancellation, and reject changed periods.
  // Stripe has no atomic compare-and-cancel primitive; keep this gap narrow.
  const originalItem = subscription.items.data[0];
  const originalStart = originalItem?.current_period_start;
  const originalEnd = originalItem?.current_period_end;
  if (!Number.isSafeInteger(originalStart) || !Number.isSafeInteger(originalEnd)) {
    return { ok: true as const, applied: false };
  }
  const stillSamePeriod = (current: Stripe.Subscription) =>
    idOf(current.customer) === customerId &&
    current.metadata.workspace_id?.trim() === workspaceId &&
    idOf(current.latest_invoice) === invoiceId &&
    current.items.data[0]?.price.id === priceId &&
    current.items.data[0]?.current_period_start === originalStart &&
    current.items.data[0]?.current_period_end === originalEnd;

  const latest = await stripe.subscriptions.retrieve(subscriptionId);
  if (!stillSamePeriod(latest) ||
      !["active", "trialing", "past_due", "canceled"].includes(latest.status)) {
    return { ok: true as const, applied: false };
  }

  // Duplicated refund events can both observe an active subscription. Recover
  // the losing request only after confirming Stripe has already canceled it.
  let canceled: Stripe.Subscription;
  if (latest.status === "canceled") {
    canceled = latest;
  } else {
    try {
      canceled = await stripe.subscriptions.cancel(subscriptionId, {
        invoice_now: false,
        prorate: false,
      });
    } catch (error) {
      if (!error || typeof error !== "object" ||
          !("code" in error) || error.code !== "resource_missing") throw error;
      const current = await stripe.subscriptions.retrieve(subscriptionId);
      if (current.status !== "canceled" || !stillSamePeriod(current)) throw error;
      canceled = current;
    }
  }
  const synced = await syncWorkspaceSubscription(canceled, eventCreated, planKey, priceId);
  if (!synced.ok && synced.code === "database") return { ok: false as const, code: "database" as const };
  return { ok: true as const, applied: synced.ok };
}
