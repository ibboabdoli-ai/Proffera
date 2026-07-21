"use server";

import { storeQuoteRequest } from "./persistence";
import { quoteRequestSchema, type QuoteRequestErrors, type QuoteRequestInput } from "./schema";

type QuoteRequestSubmission = QuoteRequestInput & {
  website?: string;
  formStartedAt?: number;
};

type SubmitQuoteRequestResult =
  | {
      ok: true;
      referenceId: string;
    }
  | {
      ok: false;
      errors: QuoteRequestErrors;
    };

export async function submitQuoteRequest(input: QuoteRequestSubmission): Promise<SubmitQuoteRequestResult> {
  const elapsed = Date.now() - Number(input.formStartedAt);

  if (input.website || !Number.isFinite(elapsed) || elapsed < 2_500 || elapsed > 24 * 60 * 60 * 1_000) {
    return { ok: false, errors: { form: "Förfrågan kunde inte skickas. Försök igen om en stund." } };
  }

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

  const result = await storeQuoteRequest(parsed.data);

  if (!result.ok) {
    return {
      ok: false,
      errors: {
        form: result.message,
      },
    };
  }

  return {
    ok: true,
    referenceId: result.referenceId,
  };
}
