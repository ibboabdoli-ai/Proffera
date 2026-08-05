import "server-only";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export type WorkspaceExperienceSettings = {
  themeKey: string;
  primaryColor: string;
  accentColor: string;
  appearance: "light" | "dark";
  heroEnabled: boolean;
  servicesEnabled: boolean;
  staffEnabled: boolean;
  reviewsEnabled: boolean;
  galleryEnabled: boolean;
  contactEnabled: boolean;
  faqEnabled: boolean;
  chatbotEnabled: boolean;
  logoUrl: string;
  heroImageUrl: string;
  heroVideoUrl: string;
  customDomain: string;
  customDomainStatus: string;
};

export type WorkspaceOnboarding = {
  industryKey: string;
  currentStep: string;
  completedSteps: string[];
  isComplete: boolean;
};

async function requireManager() {
  const sql = getSql();
  const access = await getUserWorkspaceAccess();
  if (!sql || !access.ok || !canManageWorkspaceSettings(access)) throw new Error("Owner or admin access required");
  return { sql, access };
}

export async function getWorkspaceExperienceSettings(): Promise<WorkspaceExperienceSettings> {
  const { sql, access } = await requireManager();
  await sql`insert into workspace_experience_settings (workspace_id) values (${access.workspaceId}::uuid) on conflict (workspace_id) do nothing`;
  const rows = await sql`select * from workspace_experience_settings where workspace_id = ${access.workspaceId}::uuid limit 1`;
  const row = rows[0];
  return {
    themeKey: String(row.theme_key ?? "clean"), primaryColor: String(row.primary_color ?? "#17452f"), accentColor: String(row.accent_color ?? "#d9b44a"),
    appearance: row.appearance === "dark" ? "dark" : "light", heroEnabled: Boolean(row.hero_enabled), servicesEnabled: Boolean(row.services_enabled),
    staffEnabled: Boolean(row.staff_enabled), reviewsEnabled: Boolean(row.reviews_enabled), galleryEnabled: Boolean(row.gallery_enabled),
    contactEnabled: Boolean(row.contact_enabled), faqEnabled: Boolean(row.faq_enabled), chatbotEnabled: Boolean(row.chatbot_enabled),
    logoUrl: String(row.logo_url ?? ""), heroImageUrl: String(row.hero_image_url ?? ""), heroVideoUrl: String(row.hero_video_url ?? ""),
    customDomain: String(row.custom_domain ?? ""), customDomainStatus: String(row.custom_domain_status ?? "disconnected"),
  };
}

export async function updateWorkspaceExperienceSettings(input: WorkspaceExperienceSettings) {
  const { sql, access } = await requireManager();
  const themes = new Set(["clean", "salon", "premium", "modern", "minimal"]);
  if (!themes.has(input.themeKey)) throw new Error("Invalid theme");
  if (!/^#[0-9a-f]{6}$/i.test(input.primaryColor) || !/^#[0-9a-f]{6}$/i.test(input.accentColor)) throw new Error("Invalid color");
  await sql`
    insert into workspace_experience_settings (
      workspace_id, theme_key, primary_color, accent_color, appearance, hero_enabled, services_enabled, staff_enabled,
      reviews_enabled, gallery_enabled, contact_enabled, faq_enabled, chatbot_enabled, logo_url, hero_image_url, hero_video_url, custom_domain, updated_at
    ) values (
      ${access.workspaceId}::uuid, ${input.themeKey}, ${input.primaryColor}, ${input.accentColor}, ${input.appearance}, ${input.heroEnabled},
      ${input.servicesEnabled}, ${input.staffEnabled}, ${input.reviewsEnabled}, ${input.galleryEnabled}, ${input.contactEnabled}, ${input.faqEnabled},
      ${input.chatbotEnabled}, ${input.logoUrl || null}, ${input.heroImageUrl || null}, ${input.heroVideoUrl || null}, ${input.customDomain || null}, now()
    ) on conflict (workspace_id) do update set
      theme_key = excluded.theme_key, primary_color = excluded.primary_color, accent_color = excluded.accent_color, appearance = excluded.appearance,
      hero_enabled = excluded.hero_enabled, services_enabled = excluded.services_enabled, staff_enabled = excluded.staff_enabled,
      reviews_enabled = excluded.reviews_enabled, gallery_enabled = excluded.gallery_enabled, contact_enabled = excluded.contact_enabled,
      faq_enabled = excluded.faq_enabled, chatbot_enabled = excluded.chatbot_enabled, logo_url = excluded.logo_url,
      hero_image_url = excluded.hero_image_url, hero_video_url = excluded.hero_video_url, custom_domain = excluded.custom_domain, updated_at = now()
  `;
}

export async function getWorkspaceOnboarding(): Promise<WorkspaceOnboarding> {
  const { sql, access } = await requireManager();
  await sql`insert into workspace_onboarding (workspace_id) values (${access.workspaceId}::uuid) on conflict (workspace_id) do nothing`;
  const rows = await sql`select industry_key, current_step, completed_steps, is_complete from workspace_onboarding where workspace_id = ${access.workspaceId}::uuid limit 1`;
  const row = rows[0];
  return { industryKey: String(row.industry_key ?? "other"), currentStep: String(row.current_step ?? "company"), completedSteps: Array.isArray(row.completed_steps) ? row.completed_steps.map(String) : [], isComplete: Boolean(row.is_complete) };
}

export async function updateWorkspaceOnboarding(input: WorkspaceOnboarding) {
  const { sql, access } = await requireManager();
  await sql`
    insert into workspace_onboarding (workspace_id, industry_key, current_step, completed_steps, is_complete, completed_at, updated_at)
    values (${access.workspaceId}::uuid, ${input.industryKey}, ${input.currentStep}, ${JSON.stringify(input.completedSteps)}::jsonb, ${input.isComplete}, ${input.isComplete ? new Date().toISOString() : null}::timestamptz, now())
    on conflict (workspace_id) do update set industry_key = excluded.industry_key, current_step = excluded.current_step,
      completed_steps = excluded.completed_steps, is_complete = excluded.is_complete, completed_at = excluded.completed_at, updated_at = now()
  `;
}
