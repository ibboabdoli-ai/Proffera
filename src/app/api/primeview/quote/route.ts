import { NextResponse } from "next/server";

import { sendPrimeViewQuoteEmails } from "@/features/email/lead-email";
import { primeViewQuoteRecipient, primeViewQuoteSchema } from "@/features/primeview/quote";
import { allowPublicSubmission } from "@/lib/public-form-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const genericDeliveryError = "We couldn't send your request right now. Please call PrimeView or try again shortly.";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }

  const parsed = primeViewQuoteSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete all fields with valid details." }, { status: 400 });
  }

  const quote = parsed.data;

  if (quote.website) {
    return NextResponse.json({ ok: true, confirmationSent: true }, { status: 201 });
  }

  const elapsed = Date.now() - quote.formStartedAt;
  if (elapsed < 2_500 || elapsed > 24 * 60 * 60 * 1_000) {
    return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 400 });
  }

  const allowed = await allowPublicSubmission({
    scope: "primeview_quote",
    requestHeaders: request.headers,
    identity: `${quote.email}:${quote.phone}`,
    maxAttempts: 5,
    windowSeconds: 15 * 60,
  });

  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a little while and try again." }, { status: 429 });
  }

  const delivery = await sendPrimeViewQuoteEmails({
    quote,
    recipient: primeViewQuoteRecipient,
  });

  if (!delivery.ok) {
    console.error("PrimeView quote delivery failed", delivery.message);
    return NextResponse.json({ error: genericDeliveryError }, { status: 503 });
  }

  if (!delivery.confirmationSent) {
    console.error("PrimeView quote confirmation delivery failed", delivery.confirmationError);
  }

  return NextResponse.json({ ok: true, confirmationSent: delivery.confirmationSent }, { status: 201 });
}
