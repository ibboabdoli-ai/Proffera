"use server";

import { redirect } from "next/navigation";

import { formatWorkspaceServicePrice, validateWorkspaceServicePrice } from "@/lib/workspace-service-pricing";
import { validateWorkspaceServiceDraft, type WorkspaceServiceValidationError } from "@/lib/workspace-service-policy";
import { createDashboardWorkspaceService, updateDashboardWorkspaceService } from "@/lib/workspace-services-db";
import { getDashboardWorkspaceSettings } from "@/lib/workspace-settings-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

type ServiceSaveError = "access" | "id" | WorkspaceServiceValidationError | "save";

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithServiceError(error: ServiceSaveError): never {
  redirect(`/dashboard/installningar?service_error=${error}#tjanster`);
}

async function requireWorkspaceManager() {
  if (!canManageWorkspaceSettings(await getUserWorkspaceAccess())) redirectWithServiceError("access");
}

async function getServiceInput(formData: FormData) {
  const result = validateWorkspaceServiceDraft({
    name: getFormText(formData, "name"),
    description: getFormText(formData, "description"),
    shortDescription: getFormText(formData, "short_description"),
    category: getFormText(formData, "category"),
    priceLabel: "",
    basePriceSek: getFormText(formData, "base_price_sek"),
    durationMinutes: getFormText(formData, "duration_minutes"),
    bufferBeforeMinutes: getFormText(formData, "buffer_before_minutes"),
    bufferAfterMinutes: getFormText(formData, "buffer_after_minutes"),
    minimumNoticeMinutes: getFormText(formData, "minimum_notice_minutes"),
    maximumAdvanceDays: getFormText(formData, "maximum_advance_days"),
    serviceArea: getFormText(formData, "service_area"),
    isActive: formData.get("is_active") === "on",
    sortOrder: getFormText(formData, "sort_order"),
    publicSlug: getFormText(formData, "public_slug"),
    publicStatus: getFormText(formData, "public_status") || "draft",
    conversionMode: getFormText(formData, "conversion_mode") || "book",
    seoTitle: getFormText(formData, "seo_title"),
    seoDescription: getFormText(formData, "seo_description"),
  });

  if (!result.ok) redirectWithServiceError(result.error);

  const workspaceSettings = await getDashboardWorkspaceSettings();
  const pricing = validateWorkspaceServicePrice({
    priceType: getFormText(formData, "price_type"),
    amount: getFormText(formData, "price_amount"),
    currency: workspaceSettings.billingCurrency,
  });
  if (!pricing.ok) redirectWithServiceError("price");

  return {
    ...result.value,
    priceLabel: formatWorkspaceServicePrice(pricing.value, "sv"),
    priceType: pricing.value.priceType,
    priceAmountMinor: pricing.value.amountMinor,
  };
}

export async function createWorkspaceServiceAction(formData: FormData) {
  await requireWorkspaceManager();
  const input = await getServiceInput(formData);
  try {
    await createDashboardWorkspaceService(input);
  } catch (error) {
    console.error("Failed to create workspace service", error);
    redirectWithServiceError("save");
  }
  redirect("/dashboard/installningar?service_updated=1#tjanster");
}

export async function updateWorkspaceServiceAction(formData: FormData) {
  await requireWorkspaceManager();
  const id = getFormText(formData, "service_id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) redirectWithServiceError("id");

  const input = await getServiceInput(formData);
  try {
    await updateDashboardWorkspaceService({ id, ...input });
  } catch (error) {
    console.error("Failed to update workspace service", error);
    redirectWithServiceError("save");
  }
  redirect("/dashboard/installningar?service_updated=1#tjanster");
}
