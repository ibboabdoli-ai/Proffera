import "server-only";

import { neon } from "@neondatabase/serverless";

import { verifyCustomerCalendarToken } from "@/lib/customer-calendar";
import { resolveDatabaseUrl } from "@/lib/db/database-url";

export type CustomerPortalLanguage = "sv" | "en";

export type CustomerPortalPresentation = {
  publicBookingSlug: string;
  companyName: string;
  defaultLanguage: CustomerPortalLanguage;
  swedishEnabled: boolean;
  englishEnabled: boolean;
  primaryColor: string;
  logoUrl: string;
};

const connectionString = resolveDatabaseUrl();

export async function getCustomerPortalPresentation(token: string): Promise<CustomerPortalPresentation | null> {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString) return null;

  const sql = neon(connectionString);
  const rows = await sql`
    select
      coalesce(w.public_booking_slug, '') as public_booking_slug,
      coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      coalesce(x.default_language, 'sv') as default_language,
      coalesce(x.swedish_enabled, true) as swedish_enabled,
      coalesce(x.english_enabled, true) as english_enabled,
      coalesce(nullif(x.primary_color, ''), '#17452f') as primary_color,
      coalesce(x.logo_url, '') as logo_url
    from workspaces w
    left join workspace_settings ws on ws.workspace_id = w.id::text
    left join workspace_experience_settings x on x.workspace_id = w.id
    where w.id::text = ${payload.workspaceId}
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    publicBookingSlug: String(row.public_booking_slug ?? ""),
    companyName: String(row.company_name ?? "Proffera"),
    defaultLanguage: row.default_language === "en" ? "en" : "sv",
    swedishEnabled: row.swedish_enabled !== false,
    englishEnabled: row.english_enabled !== false,
    primaryColor: /^#[0-9a-f]{6}$/i.test(String(row.primary_color ?? "")) ? String(row.primary_color) : "#17452f",
    logoUrl: String(row.logo_url ?? ""),
  };
}

export function resolveCustomerPortalLanguage(
  requested: string | undefined,
  presentation: CustomerPortalPresentation | null,
): CustomerPortalLanguage {
  if (requested === "en" && presentation?.englishEnabled) return "en";
  if (requested === "sv" && presentation?.swedishEnabled) return "sv";
  if (presentation?.defaultLanguage === "en" && presentation.englishEnabled) return "en";
  if (presentation?.defaultLanguage === "sv" && presentation.swedishEnabled) return "sv";
  if (presentation?.swedishEnabled) return "sv";
  if (presentation?.englishEnabled) return "en";
  return "sv";
}

export async function getCustomerPortalLanguage(token: string): Promise<CustomerPortalLanguage> {
  const presentation = await getCustomerPortalPresentation(token);
  return resolveCustomerPortalLanguage(undefined, presentation);
}
