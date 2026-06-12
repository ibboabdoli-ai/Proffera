import { getSql } from "@/lib/db/server";

export type CompanyRow = {
  id: string;
  reference_id: string;
  company_name: string;
  organization_number: string;
  contact_person: string;
  email: string;
  phone: string;
  city: string;
  service_areas: string;
  services: string;
  description: string;
  status: string;
  created_at: string;
};

export async function getCompanyRows() {
  const sql = getSql();

  if (!sql) {
    return { ok: false as const, message: "Databasen är inte konfigurerad.", rows: [] as CompanyRow[] };
  }

  try {
    const rows = await sql`
      select
        id,
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
        status,
        created_at
      from company_registrations
      order by created_at desc
      limit 100
    `;

    return { ok: true as const, rows: rows as CompanyRow[] };
  } catch {
    return { ok: false as const, message: "Kunde inte läsa företag. Kontrollera databastabellen.", rows: [] as CompanyRow[] };
  }
}
