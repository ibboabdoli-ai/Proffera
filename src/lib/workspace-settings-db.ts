import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

function getSqlClient() {
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
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
};

export type UpdateDashboardWorkspaceSettingsInput = {
  companyName: string;
  primaryCity: string;
  responseTimeGoal: string;
  defaultCta: string;
  contactEmail: string;
  contactPhone: string;
};

const fallbackWorkspaceSettings: DashboardWorkspaceSettings = {
  workspaceId: "default",
  companyName: "Proffera",
  primaryCity: "Stockholm",
  responseTimeGoal: "Inom 24 timmar",
  defaultCta: "Boka demo",
  contactEmail: "",
  contactPhone: "",
};

export async function getDashboardWorkspaceSettings(): Promise<DashboardWorkspaceSettings> {
  const sql = getSqlClient();

  if (!sql) {
    return fallbackWorkspaceSettings;
  }

  try {
    const rows = await sql`
      select
        workspace_id,
        company_name,
        primary_city,
        response_time_goal,
        default_cta,
        contact_email,
        contact_phone
      from workspace_settings
      where workspace_id = 'default'
      limit 1
    `;

    const row = rows[0];

    if (!row) {
      return fallbackWorkspaceSettings;
    }

    return {
      workspaceId: toText(row.workspace_id, fallbackWorkspaceSettings.workspaceId),
      companyName: toText(row.company_name, fallbackWorkspaceSettings.companyName),
      primaryCity: toText(row.primary_city, fallbackWorkspaceSettings.primaryCity),
      responseTimeGoal: toText(row.response_time_goal, fallbackWorkspaceSettings.responseTimeGoal),
      defaultCta: toText(row.default_cta, fallbackWorkspaceSettings.defaultCta),
      contactEmail: toText(row.contact_email, fallbackWorkspaceSettings.contactEmail),
      contactPhone: toText(row.contact_phone, fallbackWorkspaceSettings.contactPhone),
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

  const rows = await sql`
    update workspace_settings
    set
      company_name = ${input.companyName},
      primary_city = ${input.primaryCity},
      response_time_goal = ${input.responseTimeGoal},
      default_cta = ${input.defaultCta},
      contact_email = ${input.contactEmail},
      contact_phone = ${input.contactPhone},
      updated_at = now()
    where workspace_id = 'default'
    returning workspace_id
  `;

  if (!rows[0]) {
    throw new Error("Workspace settings row was not found for workspace_id default");
  }
}
