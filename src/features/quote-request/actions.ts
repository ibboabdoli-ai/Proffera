"use server";

import { headers } from "next/headers";

import { verifyCustomerAddress, type VerifiedCustomerAddress } from "@/lib/lantmateriet-address-verification";
import { allowPublicSubmission } from "@/lib/public-form-protection";
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

function canContinueWithoutVerifiedAddress(reason: string) {
  return reason === "too_many_candidates"
    || reason === "ambiguous_exact_match"
    || reason === "unexpected_reference_response";
}

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

  const allowed = await allowPublicSubmission({
    scope: "quote_request",
    requestHeaders: await headers(),
    identity: `${parsed.data.contactEmail}:${parsed.data.contactPhone}`,
    maxAttempts: 3,
    windowSeconds: 15 * 60,
  });

  if (!allowed) {
    return { ok: false, errors: { form: "För många försök. Vänta en stund och försök igen." } };
  }

  let verifiedAddress: VerifiedCustomerAddress | undefined;
  if (parsed.data.locationSource === "address") {
    const verification = await verifyCustomerAddress({
      addressLine1: parsed.data.addressLine1,
      postalCode: parsed.data.postalCode,
      city: parsed.data.city,
    });

    if (verification.status === "no_match" && !canContinueWithoutVerifiedAddress(verification.reason)) {
      return {
        ok: false,
        errors: {
          addressLine1: "Adressen kunde inte verifieras mot Lantmäteriets adressregister. Kontrollera gata, postnummer och ort.",
        },
      };
    }

    if (verification.status === "unavailable" && verification.reason !== "not_configured") {
      return {
        ok: false,
        errors: {
          form: "Adressen kunde inte verifieras just nu. Försök igen om en stund eller använd Nära mig.",
        },
      };
    }

    if (verification.status === "matched") verifiedAddress = verification;
  }

  const result = await storeQuoteRequest(parsed.data, verifiedAddress);

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
