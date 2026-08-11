import "server-only";

import { neon } from "@neondatabase/serverless";

import { verifyCustomerCalendarToken } from "@/lib/customer-calendar";
import { resolveDatabaseUrl } from "@/lib/db/database-url";

export type CustomerPortalLanguage = "sv" | "en";

const connectionString = resolveDatabaseUrl();

export async function getCustomerPortalLanguage(token: string): Promise<CustomerPortalLanguage> {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString) return "sv";

  const sql = neon(connectionString);
  const rows = await sql`
    select public_booking_slug
    from workspaces
    where id::text = ${payload.workspaceId}
    limit 1
  `;

  return String(rows[0]?.public_booking_slug ?? "") === "primeview" ? "en" : "sv";
}
