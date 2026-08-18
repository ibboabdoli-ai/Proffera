import "server-only";

import { getSql } from "@/lib/db/server";

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingDirectorySchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const row = error as { code?: unknown };
  return String(row.code ?? "") === "42P01";
}

export async function getCompanyDirectoryPendingVerificationCount() {
  const sql = getSql();
  if (!sql) return 0;

  try {
    const rows = await sql`
      select count(*)::int as count
      from company_directory_discovery_queue
      where state = 'pending_verify'
    `;
    return number(rows[0]?.count);
  } catch (error) {
    if (isMissingDirectorySchema(error)) return 0;
    throw error;
  }
}
