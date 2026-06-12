import { getSql } from "@/lib/db/server";

export type AdminQuoteRequest = {
  id: string;
  reference_id: string;
  category: string;
  service_type: string;
  city: string;
  postal_code: string;
  description: string;
  preferred_date: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  consent_accepted: boolean;
  status: string;
  created_at: string;
};

export type AdminQuoteRequestResult =
  | {
      ok: true;
      requests: AdminQuoteRequest[];
    }
  | {
      ok: false;
      message: string;
    };

export async function getAdminQuoteRequests(): Promise<AdminQuoteRequestResult> {
  const sql = getSql();

  if (!sql) {
    return {
      ok: false,
      message: "Databasen är inte konfigurerad ännu.",
    };
  }

  try {
    const rows = await sql`
      select
        id,
        reference_id,
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
        created_at
      from quote_requests
      order by created_at desc
      limit 100
    `;

    return {
      ok: true,
      requests: rows as AdminQuoteRequest[],
    };
  } catch {
    return {
      ok: false,
      message: "Kunde inte läsa offertförfrågningar. Kontrollera databasen och migrationen.",
    };
  }
}
