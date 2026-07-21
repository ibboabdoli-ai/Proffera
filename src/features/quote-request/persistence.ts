import { getSql } from "@/lib/db/server";
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
  const sql = getSql();

  if (!sql) {
    return {
      ok: false,
      message: "Databasen är inte konfigurerad ännu. Lägg till DATABASE_URL i Vercel och kör databasmigrationen.",
    };
  }

  const referenceId = buildReferenceId();

  try {
    const recentRows = await sql`
      select reference_id
      from quote_requests
      where created_at >= now() - interval '15 minutes'
        and (
          lower(contact_email) = lower(${input.contactEmail})
          or contact_phone = ${input.contactPhone}
        )
      order by created_at desc
      limit 1
    `;
    const recentReferenceId = String(recentRows[0]?.reference_id ?? "").trim();

    if (recentReferenceId) {
      return { ok: true, referenceId: recentReferenceId };
    }

    await sql`
      insert into quote_requests (
        category,
        service_type,
        city,
        postal_code,
        description,
        preferred_date,
        contact_name,
        contact_email,
        contact_phone,
        consent_accepted,
        status,
        reference_id
      ) values (
        ${input.category},
        ${input.serviceType},
        ${input.city},
        ${input.postalCode},
        ${input.description},
        ${input.preferredDate},
        ${input.contactName},
        ${input.contactEmail},
        ${input.contactPhone},
        ${input.consentAccepted},
        'submitted',
        ${referenceId}
      )
    `;
  } catch {
    return {
      ok: false,
      message: "Förfrågan kunde inte sparas just nu. Kontrollera DATABASE_URL och att migrationen har körts.",
    };
  }

  return {
    ok: true,
    referenceId,
  };
}
