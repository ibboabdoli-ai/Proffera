import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";
import {
  DEFAULT_WORKSPACE_MARKET,
  getWorkspaceMarketCountry,
  isWorkspaceBillingCurrency,
  isWorkspaceTimeZone,
  type WorkspaceBillingCurrency,
  type WorkspaceTimeZone,
} from "@/lib/workspace-market";

const connectionString =
  resolveDatabaseUrl();

function getSqlClient() {
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

async function getActiveWorkspace() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok) throw new Error("A valid workspace membership is required for workspace settings");
  return { id: access.workspaceId, name: access.workspaceName };
}


function toText(value: unknown, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

export type DashboardWorkspaceSettings = {
  workspaceId: string;
  companyName: string;
  primaryCity: string;
  responseTimeGoal: string;
  defaultCta: string;
  contactEmail: string;
  contactPhone: string;
  publicBookingSlug: string;
  billingCountryCode: string;
  timeZone: WorkspaceTimeZone;
  billingCurrency: WorkspaceBillingCurrency;
  vatNumber: string;
};

export type UpdateDashboardWorkspaceSettingsInput = {
  companyName: string;
  primaryCity: string;
  responseTimeGoal: string;
  defaultCta: string;
  contactEmail: string;
  contactPhone: string;
  billingCountryCode: string;
  timeZone: WorkspaceTimeZone;
  billingCurrency: WorkspaceBillingCurrency;
  vatNumber: string;
};

function createFallbackWorkspaceSettings(workspaceId: string, workspaceName: string): DashboardWorkspaceSettings {
  return {
    workspaceId,
    companyName: workspaceName,
    primaryCity: "",
    responseTimeGoal: "Inom 24 timmar",
    defaultCta: "Boka demo",
    contactEmail: "",
    contactPhone: "",
    publicBookingSlug: "",
    billingCountryCode: DEFAULT_WORKSPACE_MARKET.countryCode,
    timeZone: DEFAULT_WORKSPACE_MARKET.timeZone,
    billingCurrency: DEFAULT_WORKSPACE_MARKET.billingCurrency,
    vatNumber: "",
  };
}

function normalizeMarketRow(row: Record<string, unknown> | undefined) {
  const countryCode = toText(row?.billing_country_code, DEFAULT_WORKSPACE_MARKET.countryCode);
  const country = getWorkspaceMarketCountry(countryCode);
  const timeZone = toText(row?.time_zone, country?.defaultTimeZone ?? DEFAULT_WORKSPACE_MARKET.timeZone);
  const billingCurrency = toText(row?.billing_currency, country?.currency ?? DEFAULT_WORKSPACE_MARKET.billingCurrency);

  if (!country || !isWorkspaceTimeZone(timeZone) || !isWorkspaceBillingCurrency(billingCurrency) || country.currency !== billingCurrency) {
    return DEFAULT_WORKSPACE_MARKET;
  }

  return { countryCode, timeZone, billingCurrency } as const;
}

export async function getDashboardWorkspaceSettings(): Promise<DashboardWorkspaceSettings> {
  const sql = getSqlClient();
  const workspace = await getActiveWorkspace();
  const fallbackWorkspaceSettings = createFallbackWorkspaceSettings(workspace.id, workspace.name);

  if (!sql) {
    return fallbackWorkspaceSettings;
  }

  try {
    const workspaceId = workspace.id;
    const [rows, workspaceRows] = await Promise.all([
      sql`
      select
        workspace_id,
        company_name,
        primary_city,
        response_time_goal,
        default_cta,
        contact_email,
        contact_phone,
        billing_country_code,
        time_zone,
        billing_currency,
        vat_number
      from workspace_settings
      where workspace_id = ${workspaceId}
      limit 1
      `,
      sql`
        select public_booking_slug
        from workspaces
        where id = ${workspaceId}::uuid
        limit 1
      `,
    ]);

    const row = rows[0];

    if (!row) {
      return fallbackWorkspaceSettings;
    }

    const market = normalizeMarketRow(row);

    return {
      workspaceId: toText(row.workspace_id, fallbackWorkspaceSettings.workspaceId),
      companyName: toText(row.company_name, fallbackWorkspaceSettings.companyName),
      primaryCity: toText(row.primary_city, fallbackWorkspaceSettings.primaryCity),
      responseTimeGoal: toText(row.response_time_goal, fallbackWorkspaceSettings.responseTimeGoal),
      defaultCta: toText(row.default_cta, fallbackWorkspaceSettings.defaultCta),
      contactEmail: toText(row.contact_email, fallbackWorkspaceSettings.contactEmail),
      contactPhone: toText(row.contact_phone, fallbackWorkspaceSettings.contactPhone),
      publicBookingSlug: toText(workspaceRows[0]?.public_booking_slug, fallbackWorkspaceSettings.publicBookingSlug),
      billingCountryCode: market.countryCode,
      timeZone: market.timeZone,
      billingCurrency: market.billingCurrency,
      vatNumber: toText(row.vat_number),
    };
  } catch (error) {
    console.error("Failed to read workspace settings", error);
    return fallbackWorkspaceSettings;
  }
}

export async function updateDashboardWorkspaceSettings(input: UpdateDashboardWorkspaceSettingsInput) {
  const sql = getSqlClient();

  if (!sql) {
    throw new Error("Missing database connection for workspace settings update");
  }

  const workspace = await getActiveWorkspace();
  const workspaceId = workspace.id;
  const rows = await sql`
    insert into workspace_settings (
      workspace_id, company_name, primary_city, response_time_goal, default_cta, contact_email, contact_phone,
      billing_country_code, time_zone, billing_currency, vat_number
    )
    values (
      ${workspaceId}, ${input.companyName}, ${input.primaryCity}, ${input.responseTimeGoal}, ${input.defaultCta}, ${input.contactEmail}, ${input.contactPhone},
      ${input.billingCountryCode}, ${input.timeZone}, ${input.billingCurrency}, ${input.vatNumber}
    )
    on conflict (workspace_id) do update set
      company_name = excluded.company_name, primary_city = excluded.primary_city,
      response_time_goal = excluded.response_time_goal, default_cta = excluded.default_cta,
      contact_email = excluded.contact_email, contact_phone = excluded.contact_phone,
      billing_country_code = excluded.billing_country_code, time_zone = excluded.time_zone,
      billing_currency = excluded.billing_currency, vat_number = excluded.vat_number,
      updated_at = now()
    returning workspace_id
  `;

  if (!rows[0]) {
    throw new Error("Workspace settings could not be saved");
  }
}
