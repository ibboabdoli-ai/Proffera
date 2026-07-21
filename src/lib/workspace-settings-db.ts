import { neon } from "@neondatabase/serverless";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

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
};

export type UpdateDashboardWorkspaceSettingsInput = {
  companyName: string;
  primaryCity: string;
  responseTimeGoal: string;
  defaultCta: string;
  contactEmail: string;
  contactPhone: string;
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
  };
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
        contact_phone
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

    return {
      workspaceId: toText(row.workspace_id, fallbackWorkspaceSettings.workspaceId),
      companyName: toText(row.company_name, fallbackWorkspaceSettings.companyName),
      primaryCity: toText(row.primary_city, fallbackWorkspaceSettings.primaryCity),
      responseTimeGoal: toText(row.response_time_goal, fallbackWorkspaceSettings.responseTimeGoal),
      defaultCta: toText(row.default_cta, fallbackWorkspaceSettings.defaultCta),
      contactEmail: toText(row.contact_email, fallbackWorkspaceSettings.contactEmail),
      contactPhone: toText(row.contact_phone, fallbackWorkspaceSettings.contactPhone),
      publicBookingSlug: toText(workspaceRows[0]?.public_booking_slug, fallbackWorkspaceSettings.publicBookingSlug),
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
    insert into workspace_settings (workspace_id, company_name, primary_city, response_time_goal, default_cta, contact_email, contact_phone)
    values (${workspaceId}, ${input.companyName}, ${input.primaryCity}, ${input.responseTimeGoal}, ${input.defaultCta}, ${input.contactEmail}, ${input.contactPhone})
    on conflict (workspace_id) do update set
      company_name = excluded.company_name, primary_city = excluded.primary_city,
      response_time_goal = excluded.response_time_goal, default_cta = excluded.default_cta,
      contact_email = excluded.contact_email, contact_phone = excluded.contact_phone, updated_at = now()
    returning workspace_id
  `;

  if (!rows[0]) {
    throw new Error("Workspace settings could not be saved");
  }
}
