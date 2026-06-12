"use server";

import { quoteRequestSchema, type QuoteRequestErrors, type QuoteRequestInput } from "./schema";

type SubmitQuoteRequestResult =
  | {
      ok: true;
      referenceId: string;
    }
  | {
      ok: false;
      errors: QuoteRequestErrors;
    };

function buildReferenceId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PRO-${timestamp}-${randomPart}`;
}

export async function submitQuoteRequest(input: QuoteRequestInput): Promise<SubmitQuoteRequestResult> {
  const parsed = quoteRequestSchema.safeParse(input);

  if (!parsed.success) {
    const errors: QuoteRequestErrors = {};

    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !(field in errors)) {
        errors[field as keyof QuoteRequestErrors] = issue.message;
      }
    }

    return { ok: false, errors };
  }

  // Database persistence is intentionally deferred to the database phase.
  // This server action proves server-side validation and returns a temporary reference.
  return {
    ok: true,
    referenceId: buildReferenceId(),
  };
}
