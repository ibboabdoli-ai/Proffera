"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { refreshLowConfidenceCompanyDirectoryBatch } from "@/lib/company-directory-manual-refresh";
import { publishCompanyDirectoryProfileFromAdmin } from "@/lib/company-directory-publication-admin";

const DIRECTORY_STATUS_FILTERS = new Set(["published", "ready", "review", "inactive"]);

function formText(formData: FormData, name: string, maxLength: number) {
  return String(formData.get(name) ?? "").trim().slice(0, maxLength);
}

function safeReturnContext(referer: string) {
  try {
    const url = new URL(referer);
    if (url.pathname !== "/admin/foretag/directory") return { status: "", query: "", page: 1 };
    const status = (url.searchParams.get("status") ?? "").trim().toLowerCase();
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
    const parsedPage = Number(url.searchParams.get("page"));
    return {
      status: DIRECTORY_STATUS_FILTERS.has(status) ? status : "",
      query,
      page: Number.isFinite(parsedPage) ? Math.max(1, Math.floor(parsedPage)) : 1,
    };
  } catch {
    return { status: "", query: "", page: 1 };
  }
}

export async function publishDirectoryProfileAction(formData: FormData) {
  const profileId = formText(formData, "profileId", 80);
  const requestHeaders = await headers();
  const context = safeReturnContext(requestHeaders.get("referer") ?? "");
  const result = await publishCompanyDirectoryProfileFromAdmin(profileId);

  revalidatePath("/admin/foretag/directory");
  if (result.slug) revalidatePath(`/foretag/listad/${result.slug}`);

  const params = new URLSearchParams({ publish: result.code });
  if (context.status) params.set("status", context.status);
  if (context.query) params.set("q", context.query);
  if (context.page > 1) params.set("page", String(context.page));
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
