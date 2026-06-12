import { getSql } from "@/lib/db/server";

export type OutboxRow = {
  id: string;
  lead_ref: string;
  company_name: string;
  company_email: string;
  status: string;
  method: string;
  created_at: string;
};

export async function addOutboxRow(input: {
  leadRef: string;
  companyName: string;
  companyEmail: string;
  method: string;
}) {
  const sql = getSql();

  if (!sql) {
    return { ok: false as const, message: "Databasen är inte konfigurerad." };
  }

  try {
    const existing = await sql`
      select id
      from lead_outbox
      where lead_ref = ${input.leadRef}
        and company_email = ${input.companyEmail}
      limit 1
    `;

    if (existing.length > 0) {
      return { ok: true as const, duplicate: true as const };
    }

    await sql`
      insert into lead_outbox (lead_ref, company_name, company_email, status, method)
      values (${input.leadRef}, ${input.companyName}, ${input.companyEmail}, 'sent', ${input.method})
    `;
    return { ok: true as const, duplicate: false as const };
  } catch {
    return { ok: false as const, message: "Kunde inte spara logg." };
  }
}

export async function getOutboxRows() {
  const sql = getSql();

  if (!sql) {
    return { ok: false as const, message: "Databasen är inte konfigurerad.", rows: [] as OutboxRow[] };
  }

  try {
    const rows = await sql`
      select * from (
        select distinct on (lead_ref, company_email)
          id, lead_ref, company_name, company_email, status, method, created_at
        from lead_outbox
        order by lead_ref, company_email, created_at desc
      ) latest_logs
      order by created_at desc
      limit 100
    `;
    return { ok: true as const, rows: rows as OutboxRow[] };
  } catch {
    return { ok: false as const, message: "Kunde inte läsa loggar.", rows: [] as OutboxRow[] };
  }
}
