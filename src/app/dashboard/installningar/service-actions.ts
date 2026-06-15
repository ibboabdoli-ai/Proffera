"use server";

import { redirect } from "next/navigation";

import {
  createDashboardWorkspaceService,
  updateDashboardWorkspaceService,
  type WriteDashboardWorkspaceServiceInput,
} from "@/lib/workspace-services-db";

type ServiceSaveError =
  | "access"
  | "disabled"
  | "id"
  | "name"
  | "description"
  | "category"
  | "price"
  | "base_price"
  | "duration"
  | "area"
  | "sort"
  | "save";

function getFormText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectWithServiceError(error: ServiceSaveError): never {
  redirect(`/dashboard/installningar?service_error=${error}#tjanster`);
}

function requireAccessCode(formData: FormData) {
  const expectedCode = (process.env.DASHBOARD_WRITE_CODE ?? process.env.ADMIN_ACCESS_CODE ?? "").trim();

  if (!expectedCode) {
    redirectWithServiceError("disabled");
  }

  if (getFormText(formData, "access_code") !== expectedCode) {
    redirectWithServiceError("access");
  }
}

function parseOptionalInteger(formData: FormData, key: string, min: number, max: number, error: ServiceSaveError) {
  const rawValue = getFormText(formData, key);

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < min || value > max) {
    redirectWithServiceError(error);
  }

  return value;
}

function parseRequiredInteger(formData: FormData, key: string, min: number, max: number, error: ServiceSaveError) {
  const rawValue = getFormText(formData, key);
  const value = Number(rawValue);

  if (!rawValue || !Number.isInteger(value) || value < min || value > max) {
    redirectWithServiceError(error);
  }

  return value;
}

function getServiceInput(formData: FormData): WriteDashboardWorkspaceServiceInput {
  const name = getFormText(formData, "name");
  const description = getFormText(formData, "description");
  const category = getFormText(formData, "category");
  const priceLabel = getFormText(formData, "price_label");
  const serviceArea = getFormText(formData, "service_area");

  if (!name || name.length > 140) {
    redirectWithServiceError("name");
  }

  if (description.length > 500) {
    redirectWithServiceError("description");
  }

  if (category.length > 120) {
    redirectWithServiceError("category");
  }

  if (priceLabel.length > 120) {
    redirectWithServiceError("price");
  }

  if (serviceArea.length > 240) {
    redirectWithServiceError("area");
  }

  return {
    name,
    description,
    category,
    priceLabel,
    basePriceSek: parseOptionalInteger(formData, "base_price_sek", 0, 9999999, "base_price"),
    durationMinutes: parseOptionalInteger(formData, "duration_minutes", 1, 1440, "duration"),
    serviceArea,
    isActive: formData.get("is_active") === "on",
    sortOrder: parseRequiredInteger(formData, "sort_order", 0, 9999, "sort"),
  };
}

export async function createWorkspaceServiceAction(formData: FormData) {
  requireAccessCode(formData);
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
  requireAccessCode(formData);
  const id = getFormText(formData, "service_id");

  if (!id) {
    redirectWithServiceError("id");
  }

  const input = getServiceInput(formData);

  try {
    await updateDashboardWorkspaceService({ id, ...input });
  } catch (error) {
    console.error("Failed to update workspace service", error);
    redirectWithServiceError("save");
  }

  redirect("/dashboard/installningar?service_updated=1#tjanster");
}
