import { getSql } from "@/lib/db/server";
import type { CompanyRegistrationInput } from "./schema";

type StoreCompanyResult =
  | { ok: true; referenceId: string }
  | { ok: false; message: string };

function buildCompanyReferenceId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `COM-${timestamp}-${randomPart}`;
}

export async function storeCompanyRegistration(input: CompanyRegistrationInput): Promise<StoreCompanyResult> {
  const sql = getSql();

  if (!sql) {
    return { ok: false, message: "Databasen är inte konfigurerad ännu." };
  }

  const referenceId = buildCompanyReferenceId();

  try {
    await sql`
      insert into company_registrations (
        reference_id,
        company_name,
        organization_number,
        contact_person,
        email,
        phone,
        city,
        service_areas,
        services,
        description,
        status
      ) values (
        ${referenceId},
        ${input.companyName},
        ${input.organizationNumber},
        ${input.contactPerson},
        ${input.email},
        ${input.phone},
        ${input.city},
        ${input.serviceAreas},
        ${input.services},
        ${input.description},
        'pending'
      )
    `;
  } catch {
    return { ok: false, message: "Företagsansökan kunde inte sparas. Kontrollera att databastabellen finns." };
  }

  return { ok: true, referenceId };
}
