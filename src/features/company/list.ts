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

export type WorkspaceCompanyRow = {
  id: string;
  name: string;
  company_name: string;
  slug: string;
  public_booking_slug: string | null;
  primary_city: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  plan_key: string | null;
  plan_status: string | null;
  booking_enabled: boolean;
  crm_customers_enabled: boolean;
  lead_inbox_enabled: boolean;
  member_count: number;
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

export async function getWorkspaceCompanyRows() {
  const sql = getSql();

  if (!sql) {
    return { ok: false as const, message: "Databasen är inte konfigurerad.", rows: [] as WorkspaceCompanyRow[] };
  }

  try {
    const rows = await sql`
      select
        w.id,
        w.name,
        w.company_name,
        w.slug,
        w.public_booking_slug,
        w.primary_city,
        w.contact_email,
        w.contact_phone,
        w.status,
        plan.plan_key,
        plan.status as plan_status,
        exists (
          select 1 from workspace_feature_flags wff
          where wff.workspace_id = w.id and wff.feature_key = 'booking_demo' and wff.enabled = true
        ) as booking_enabled,
        exists (
          select 1 from workspace_feature_flags wff
          where wff.workspace_id = w.id and wff.feature_key = 'crm_customers' and wff.enabled = true
        ) as crm_customers_enabled,
        exists (
          select 1 from workspace_feature_flags wff
          where wff.workspace_id = w.id and wff.feature_key = 'lead_inbox' and wff.enabled = true
        ) as lead_inbox_enabled,
        (select count(*)::int from workspace_memberships wm where wm.workspace_id = w.id) as member_count,
        w.created_at
      from workspaces w
      left join lateral (
        select wp.plan_key, wp.status
        from workspace_plans wp
        where wp.workspace_id = w.id
        order by wp.created_at desc
        limit 1
      ) plan on true
      order by w.created_at desc
      limit 100
    `;

    return {
      ok: true as const,
      rows: rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        company_name: String(row.company_name ?? row.name),
        slug: String(row.slug),
        public_booking_slug: row.public_booking_slug ? String(row.public_booking_slug) : null,
        primary_city: row.primary_city ? String(row.primary_city) : null,
        contact_email: row.contact_email ? String(row.contact_email) : null,
        contact_phone: row.contact_phone ? String(row.contact_phone) : null,
        status: String(row.status),
        plan_key: row.plan_key ? String(row.plan_key) : null,
        plan_status: row.plan_status ? String(row.plan_status) : null,
        booking_enabled: row.booking_enabled === true,
        crm_customers_enabled: row.crm_customers_enabled === true,
        lead_inbox_enabled: row.lead_inbox_enabled === true,
        member_count: Number(row.member_count ?? 0),
        created_at: String(row.created_at),
      })) as WorkspaceCompanyRow[],
    };
  } catch (error) {
    console.error("Failed to read workspace companies", error);
    return { ok: false as const, message: "Kunde inte läsa aktiva kundkonton.", rows: [] as WorkspaceCompanyRow[] };
  }
}
