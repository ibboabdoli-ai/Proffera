import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { QuoteRequestInput } from "./schema";

type StoreQuoteRequestResult =
  | {
      ok: true;
      referenceId: string;
    }
  | {
      ok: false;
      message: string;
    };

function buildReferenceId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `PRO-${timestamp}-${randomPart}`;
}

export async function storeQuoteRequest(input: QuoteRequestInput): Promise<StoreQuoteRequestResult> {
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return {
      ok: false,
      message: "Supabase är inte konfigurerat ännu. Lägg till projektets anslutningsvärden i Vercel och kör migrationen.",
    };
  }

  const referenceId = buildReferenceId();

  const { error } = await supabase.from("quote_requests").insert({
    category: input.category,
    service_type: input.serviceType,
    city: input.city,
    postal_code: input.postalCode,
    description: input.description,
    preferred_date: input.preferredDate,
    contact_name: input.contactName,
    contact_email: input.contactEmail,
    contact_phone: input.contactPhone,
    consent_accepted: input.consentAccepted,
    status: "submitted",
    reference_id: referenceId,
  });

  if (error) {
    return {
      ok: false,
      message: "Förfrågan kunde inte sparas just nu. Kontrollera databastabellen och åtkomstreglerna.",
    };
  }

  return {
    ok: true,
    referenceId,
  };
}
