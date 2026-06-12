import { getSql } from "@/lib/db/server";
import type { CompanyRow } from "@/features/company/list";

type LeadRow = {
  id: string;
  reference_id: string;
  category: string;
  service_type: string;
  city: string;
  postal_code: string;
  description: string;
  status: string;
  created_at: string;
};

export type LeadMatch = {
  lead: LeadRow;
  companies: Array<CompanyRow & { score: number; reasons: string[] }>;
};

function includesText(source: string, target: string) {
  return source.toLowerCase().includes(target.toLowerCase());
}

function scoreCompany(lead: LeadRow, company: CompanyRow) {
  let score = 0;
  const reasons: string[] = [];

  if (includesText(company.city, lead.city) || includesText(company.service_areas, lead.city)) {
    score += 50;
    reasons.push("område");
  }

  if (includesText(company.services, lead.category)) {
    score += 35;
    reasons.push("kategori");
  }

  if (includesText(company.services, lead.service_type)) {
    score += 20;
    reasons.push("tjänst");
  }

  if (company.status === "approved") {
    score += 10;
    reasons.push("godkänt företag");
  }

  return { score, reasons };
}

export async function getLeadMatches() {
  const sql = getSql();

  if (!sql) {
    return { ok: false as const, message: "Databasen är inte konfigurerad.", matches: [] as LeadMatch[] };
  }

  try {
    const leads = await sql`
      select id, reference_id, category, service_type, city, postal_code, description, status, created_at
      from quote_requests
      order by created_at desc
      limit 50
    `;

    const companies = await sql`
      select id, reference_id, company_name, organization_number, contact_person, email, phone, city,
        service_areas, services, description, status, created_at
      from company_registrations
      order by created_at desc
      limit 200
    `;

    const matches = (leads as LeadRow[]).map((lead) => {
      const scoredCompanies = (companies as CompanyRow[])
        .map((company) => {
          const result = scoreCompany(lead, company);
          return { ...company, score: result.score, reasons: result.reasons };
        })
        .filter((company) => company.score >= 50)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      return { lead, companies: scoredCompanies };
    });

    return { ok: true as const, matches };
  } catch {
    return { ok: false as const, message: "Kunde inte läsa matchningar.", matches: [] as LeadMatch[] };
  }
}
