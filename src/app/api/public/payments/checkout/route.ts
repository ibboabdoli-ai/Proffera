import { NextResponse } from "next/server";

import { getStripeClient } from "@/lib/stripe";
import { bindServiceJobCheckoutSession, getPublicServiceJobPayment } from "@/lib/workspace-service-job-payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const token = String(formData?.get("token") ?? "");
  const payment = await getPublicServiceJobPayment(token);
  if (!payment || payment.status !== "pending" || !payment.accountReady) return NextResponse.json({ error: "payment_unavailable" }, { status: 400 });
  const stripe = getStripeClient();
  if (!stripe) return NextResponse.json({ error: "stripe_unavailable" }, { status: 503 });

  try {
    if (payment.checkoutSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(payment.checkoutSessionId).catch(() => null);
      if (existing?.status === "open" && existing.url) return NextResponse.redirect(existing.url, 303);
      if (existing?.status === "complete") return NextResponse.redirect(new URL(`/betala/${token}`, request.url), 303);
    }

    const baseUrl = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: payment.currency.toLowerCase(),
          unit_amount: payment.amountMinor,
          product_data: { name: payment.title || "Service" },
        },
      }],
      client_reference_id: payment.id,
      metadata: {
        payment_kind: "service_job",
        payment_request_id: payment.id,
        workspace_id: payment.workspaceId,
        service_job_id: payment.serviceJobId,
      },
      payment_intent_data: {
        transfer_data: { destination: payment.stripeAccountId },
        metadata: {
          payment_kind: "service_job",
          payment_request_id: payment.id,
          workspace_id: payment.workspaceId,
          service_job_id: payment.serviceJobId,
        },
      },
      success_url: `${baseUrl}/betala/${token}?status=success`,
      cancel_url: `${baseUrl}/betala/${token}`,
    });
    if (!session.url) return NextResponse.json({ error: "checkout_unavailable" }, { status: 502 });
    await bindServiceJobCheckoutSession(payment.id, session.id);
    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    console.error("Failed to create service job checkout", error);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
