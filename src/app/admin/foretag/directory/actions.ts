"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { refreshLowConfidenceCompanyDirectoryBatch } from "@/lib/company-directory-manual-refresh";
import { publishCompanyDirectoryProfileFromAdmin } from "@/lib/company-directory-publication-admin";

const DIRECTORY_STATUS_FILTERS = new Set(["published", "ready", "review", "inactive"]);

function formText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "").trim().slice(0, maxLength);
}

export async function publishDirectoryProfileAction(formData: FormData) {
  const profileId = formText(formData, "profileId", 80);
  const returnStatus = formText(formData, "returnStatus", 20).toLowerCase();
  const returnQuery = formText(formData, "returnQuery", 120);
  const parsedPage = Number(formText(formData, "returnPage", 8));
  const returnPage = Number.isFinite(parsedPage) ? Math.max(1, Math.floor(parsedPage)) : 1;
  const result = await publishCompanyDirectoryProfileFromAdmin(profileId);

  revalidatePath("/admin/foretag/directory");
  if (result.slug) revalidatePath(`/foretag/listad/${result.slug}`);

  const params = new URLSearchParams({ publish: result.code });
  if (DIRECTORY_STATUS_FILTERS.has(returnStatus)) params.set("status", returnStatus);
  if (returnQuery) params.set("q", returnQuery);
  if (returnPage > 1) params.set("page", String(returnPage));
  redirect(`/admin/foretag/directory?${params.toString()}`);
}

export async function refreshLowConfidenceDirectoryBatchAction(scanStartedAt?: string) {
  await requireSuperAdmin();

  const result = await refreshLowConfidenceCompanyDirectoryBatch({
    scanStartedAt,
    limit: 3,
  });

  revalidatePath("/admin/foretag/directory");
  for (const slug of result.publishedSlugs) {
    revalidatePath(`/foretag/listad/${slug}`);
  }

  return result;
}
