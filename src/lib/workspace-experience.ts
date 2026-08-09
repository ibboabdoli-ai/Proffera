import "server-only";

import { normalizeBookingThemeAppearance } from "@/lib/booking-theme-contract";
import { getSql } from "@/lib/db/server";
import { normalizeCustomDomainInput } from "@/lib/public-site-domains";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export type WorkspaceLanguage = "sv" | "en";

export type WorkspaceExperienceSettings = {
  themeKey: string;
  primaryColor: string;
  accentColor: string;
  appearance: "light" | "dark";
  defaultLanguage: WorkspaceLanguage;
  swedishEnabled: boolean;
  englishEnabled: boolean;
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

const defaultExperience: WorkspaceExperienceSettings = {
  themeKey: "clean",
  primaryColor: "#17452f",
  accentColor: "#d9b44a",
  appearance: "light",
  defaultLanguage: "sv",
  swedishEnabled: true,
  englishEnabled: true,
  heroEnabled: true,
  servicesEnabled: true,
  staffEnabled: true,
  reviewsEnabled: true,
  galleryEnabled: false,
  contactEnabled: true,
  faqEnabled: false,
  chatbotEnabled: false,
  logoUrl: "",
  heroImageUrl: "",
  heroVideoUrl: "",
  customDomain: "",
  customDomainStatus: "disconnected",
};

function mapExperienceRow(row: Record<string, unknown> | undefined): WorkspaceExperienceSettings {
  if (!row) return defaultExperience;
  const themeKey = String(row.theme_key ?? defaultExperience.themeKey);
  const storedAppearance = row.appearance === "dark" ? "dark" : "light";
  return {
    themeKey,
    primaryColor: String(row.primary_color ?? defaultExperience.primaryColor),
    accentColor: String(row.accent_color ?? defaultExperience.accentColor),
    appearance: normalizeBookingThemeAppearance(themeKey, storedAppearance),
    defaultLanguage: row.default_language === "en" ? "en" : "sv",
    swedishEnabled: row.swedish_enabled !== false,
    englishEnabled: row.english_enabled !== false,
    heroEnabled: Boolean(row.hero_enabled),
    servicesEnabled: Boolean(row.services_enabled),
    staffEnabled: Boolean(row.staff_enabled),
    reviewsEnabled: Boolean(row.reviews_enabled),
    galleryEnabled: Boolean(row.gallery_enabled),
    contactEnabled: Boolean(row.contact_enabled),
    faqEnabled: Boolean(row.faq_enabled),
    chatbotEnabled: Boolean(row.chatbot_enabled),
    logoUrl: String(row.logo_url ?? ""),
    heroImageUrl: String(row.hero_image_url ?? ""),
    heroVideoUrl: String(row.hero_video_url ?? ""),
    customDomain: String(row.custom_domain ?? ""),
    customDomainStatus: String(row.custom_domain_status ?? "disconnected"),
  };
}

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
  return mapExperienceRow(rows[0] as Record<string, unknown> | undefined);
}

export async function getPublicWorkspaceExperienceSettings(workspaceId: string): Promise<WorkspaceExperienceSettings> {
  const sql = getSql();
  if (!sql || !/^[0-9a-f-]{36}$/i.test(workspaceId)) return defaultExperience;
  const rows = await sql`select * from workspace_experience_settings where workspace_id = ${workspaceId}::uuid limit 1`;
  return mapExperienceRow(rows[0] as Record<string, unknown> | undefined);
}

export async function updateWorkspaceExperienceSettings(input: WorkspaceExperienceSettings) {
  const { sql, access } = await requireManager();
  const themes = new Set(["clean", "salon", "premium", "modern", "minimal", "restaurant"]);
  if (!themes.has(input.themeKey)) throw new Error("Invalid theme");
  if (!/^#[0-9a-f]{6}$/i.test(input.primaryColor) || !/^#[0-9a-f]{6}$/i.test(input.accentColor)) throw new Error("Invalid color");
  if (!input.swedishEnabled && !input.englishEnabled) throw new Error("At least one language must be enabled");

  const rawCustomDomain = input.customDomain.trim();
  const customDomain = normalizeCustomDomainInput(rawCustomDomain);
  if (rawCustomDomain && !customDomain) throw new Error("INVALID_CUSTOM_DOMAIN");

  if (customDomain) {
    const duplicate = await sql`
      select workspace_id
      from workspace_experience_settings
      where workspace_id <> ${access.workspaceId}::uuid
        and lower(
          split_part(
            regexp_replace(trim(coalesce(custom_domain, '')), '^https?://', '', 'i'),
            '/',
            1
          )
        ) = ${customDomain}
      limit 1
    `;
    if (duplicate[0]) throw new Error("CUSTOM_DOMAIN_TAKEN");
  }

  const defaultLanguage: WorkspaceLanguage = input.defaultLanguage === "en" && input.englishEnabled ? "en" : "sv";
  const appearance = normalizeBookingThemeAppearance(input.themeKey, input.appearance);
  await sql`
    insert into workspace_experience_settings (
      workspace_id, theme_key, primary_color, accent_color, appearance, default_language, swedish_enabled, english_enabled,
      hero_enabled, services_enabled, staff_enabled, reviews_enabled, gallery_enabled, contact_enabled, faq_enabled,
      chatbot_enabled, logo_url, hero_image_url, hero_video_url, custom_domain, custom_domain_status, updated_at
    ) values (
      ${access.workspaceId}::uuid, ${input.themeKey}, ${input.primaryColor}, ${input.accentColor}, ${appearance}, ${defaultLanguage},
      ${input.swedishEnabled}, ${input.englishEnabled}, ${input.heroEnabled}, ${input.servicesEnabled}, ${input.staffEnabled},
      ${input.reviewsEnabled}, ${input.galleryEnabled}, ${input.contactEnabled}, ${input.faqEnabled}, ${input.chatbotEnabled},
      ${input.logoUrl || null}, ${input.heroImageUrl || null}, ${input.heroVideoUrl || null}, ${customDomain || null}, 'disconnected', now()
    ) on conflict (workspace_id) do update set
      theme_key = excluded.theme_key, primary_color = excluded.primary_color, accent_color = excluded.accent_color,
      appearance = excluded.appearance, default_language = excluded.default_language, swedish_enabled = excluded.swedish_enabled,
      english_enabled = excluded.english_enabled, hero_enabled = excluded.hero_enabled, services_enabled = excluded.services_enabled,
      staff_enabled = excluded.staff_enabled, reviews_enabled = excluded.reviews_enabled, gallery_enabled = excluded.gallery_enabled,
      contact_enabled = excluded.contact_enabled, faq_enabled = excluded.faq_enabled, chatbot_enabled = excluded.chatbot_enabled,
      logo_url = excluded.logo_url, hero_image_url = excluded.hero_image_url, hero_video_url = excluded.hero_video_url,
      custom_domain_status = case
        when workspace_experience_settings.custom_domain is distinct from excluded.custom_domain then 'disconnected'
        else workspace_experience_settings.custom_domain_status
      end,
      custom_domain = excluded.custom_domain, updated_at = now()
  `;
}

export async function setWorkspaceCustomDomainConnectionStatus(domainInput: string, connected: boolean) {
  const { sql, access } = await requireManager();
  const domain = normalizeCustomDomainInput(domainInput);
  if (!domain) return false;

  const rows = await sql`
    update workspace_experience_settings
    set custom_domain_status = ${connected ? "connected" : "disconnected"}, updated_at = now()
    where workspace_id = ${access.workspaceId}::uuid
      and lower(
        split_part(
          regexp_replace(trim(coalesce(custom_domain, '')), '^https?://', '', 'i'),
          '/',
          1
        )
      ) = ${domain}
    returning workspace_id
  `;
  return Boolean(rows[0]?.workspace_id);
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
