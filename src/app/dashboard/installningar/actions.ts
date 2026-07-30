"use server";

import { redirect } from "next/navigation";

import { updateDashboardWorkspaceSettings, type UpdateDashboardWorkspaceSettingsInput } from "@/lib/workspace-settings-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { getSql } from "@/lib/db/server";

type SettingsSaveError = "access" | "company" | "city" | "response" | "cta" | "email" | "phone" | "slug" | "save";

function getFormText(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
function localized(path: string, formData: FormData) { return String(formData.get("lang") ?? "") === "en" ? `${path}${path.includes("?") ? "&" : "?"}lang=en` : path; }
function redirectWithError(error: SettingsSaveError, formData: FormData): never { redirect(localized(`/dashboard/installningar?error=${error}`, formData)); }
function isEmailLike(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

export async function updateWorkspaceSettingsAction(formData: FormData) {
  const workspaceAccess = await getUserWorkspaceAccess();
  if (!workspaceAccess.ok || !canManageWorkspaceSettings(workspaceAccess)) redirectWithError("access", formData);
  const companyName = getFormText(formData, "company_name");
  const primaryCity = getFormText(formData, "primary_city");
  const responseTimeGoal = getFormText(formData, "response_time_goal");
  const defaultCta = getFormText(formData, "default_cta");
  const contactEmail = getFormText(formData, "contact_email");
  const contactPhone = getFormText(formData, "contact_phone");
  const publicBookingSlug = getFormText(formData, "public_booking_slug").toLowerCase();
  if (!companyName || companyName.length > 160) redirectWithError("company", formData);
  if (!primaryCity || primaryCity.length > 120) redirectWithError("city", formData);
  if (!responseTimeGoal || responseTimeGoal.length > 120) redirectWithError("response", formData);
  if (!defaultCta || defaultCta.length > 80) redirectWithError("cta", formData);
  if (contactEmail && (contactEmail.length > 180 || !isEmailLike(contactEmail))) redirectWithError("email", formData);
  if (contactPhone.length > 80) redirectWithError("phone", formData);
  if (publicBookingSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicBookingSlug)) redirectWithError("slug", formData);
  const input: UpdateDashboardWorkspaceSettingsInput = { companyName, primaryCity, responseTimeGoal, defaultCta, contactEmail, contactPhone };
  try {
    await updateDashboardWorkspaceSettings(input);
    if (publicBookingSlug) {
      const sql = getSql();
      if (!sql) redirectWithError("save", formData);
      await sql`update workspaces set public_booking_slug = ${publicBookingSlug}, updated_at = now() where id = ${workspaceAccess.workspaceId}::uuid`;
    }
  } catch (error) {
    console.error("Failed to update workspace settings", error);
    redirectWithError("save", formData);
  }
  redirect(localized("/dashboard/installningar?updated=1", formData));
}
