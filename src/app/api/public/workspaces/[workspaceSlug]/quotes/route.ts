import { NextResponse } from "next/server";

import {
  isPlausiblePublicQuoteTiming,
  publicWorkspaceQuoteSchema,
} from "@/features/workspace-quotes/public-quote";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { createPublicWorkspaceQuoteRequest } from "@/lib/workspace-quote-requests-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ workspaceSlug: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = publicWorkspaceQuoteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the submitted details." }, { status: 400 });
  }

  const quote = parsed.data;
  if (quote.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  if (!isPlausiblePublicQuoteTiming(quote.formStartedAt)) {
    return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 400 });
  }

  const { workspaceSlug } = await context.params;
  const normalizedSlug = workspaceSlug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const allowed = await allowPublicSubmission({
    scope: `workspace_quote:${normalizedSlug}`,
    requestHeaders: request.headers,
    identity: `${quote.email.toLowerCase()}:${quote.phone}`,
    maxAttempts: 5,
    windowSeconds: 15 * 60,
  });

  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  try {
    const result = await createPublicWorkspaceQuoteRequest(normalizedSlug, quote);

    if (!result.ok) {
      const status = result.reason === "workspace" ? 404 : 400;
      return NextResponse.json({ error: "The selected workspace or service is unavailable." }, { status });
    }

    return NextResponse.json(
      { ok: true, referenceId: result.referenceId },
      { status: 201 },
    );
  } catch (error) {
    console.error("Public workspace quote submission failed", error);
    return NextResponse.json(
      { error: "The request could not be submitted right now." },
      { status: 503 },
    );
  }
}
