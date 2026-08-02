"use server";

import { redirect } from "next/navigation";

import {
  createDashboardWorkspaceService,
  updateDashboardWorkspaceService,
} from "@/lib/workspace-services-db";
import { validateWorkspaceServiceDraft, type WorkspaceServiceValidationError } from "@/lib/workspace-service-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

type ServiceSaveError = "access" | "id" | WorkspaceServiceValidationError | "save";

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithServiceError(error: ServiceSaveError): never {
  redirect(`/dashboard/installningar?service_error=${error}#tjanster`);
}

async function requireWorkspaceManager() {
  if (!canManageWorkspaceSettings(await getUserWorkspaceAccess())) {
    redirectWithServiceError("access");
  }
}

function getServiceInput(formData: FormData) {
  const result = validateWorkspaceServiceDraft({
    name: getFormText(formData, "name"),
    description: getFormText(formData, "description"),
    category: getFormText(formData, "category"),
    priceLabel: getFormText(formData, "price_label"),
    basePriceSek: getFormText(formData, "base_price_sek"),
    durationMinutes: getFormText(formData, "duration_minutes"),
    bufferBeforeMinutes: getFormText(formData, "buffer_before_minutes"),
    bufferAfterMinutes: getFormText(formData, "buffer_after_minutes"),
    minimumNoticeMinutes: getFormText(formData, "minimum_notice_minutes"),
    maximumAdvanceDays: getFormText(formData, "maximum_advance_days"),
    serviceArea: getFormText(formData, "service_area"),
    isActive: formData.get("is_active") === "on",
    sortOrder: getFormText(formData, "sort_order"),
  });

  if (!result.ok) redirectWithServiceError(result.error);
  return result.value;
}

export async function createWorkspaceServiceAction(formData: FormData) {
  await requireWorkspaceManager();
  const input = getServiceInput(formData);

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
  if (!id) redirectWithServiceError("id");

  const input = getServiceInput(formData);

  try {
    await updateDashboardWorkspaceService({ id, ...input });
  } catch (error) {
    console.error("Failed to update workspace service", error);
    redirectWithServiceError("save");
  }

  redirect("/dashboard/installningar?service_updated=1#tjanster");
}
