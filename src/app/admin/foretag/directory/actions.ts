"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { refreshLowConfidenceCompanyDirectoryBatch } from "@/lib/company-directory-manual-refresh";
import { publishCompanyDirectoryProfileFromAdmin } from "@/lib/company-directory-publication-admin";

export async function publishDirectoryProfileAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const result = await publishCompanyDirectoryProfileFromAdmin(profileId);

  revalidatePath("/admin/foretag/directory");
  if (result.slug) revalidatePath(`/foretag/listad/${result.slug}`);
  redirect(`/admin/foretag/directory?publish=${encodeURIComponent(result.code)}`);
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
