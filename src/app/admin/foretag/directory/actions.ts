"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { publishCompanyDirectoryProfileFromAdmin } from "@/lib/company-directory-publication-admin";

export async function publishDirectoryProfileAction(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const result = await publishCompanyDirectoryProfileFromAdmin(profileId);

  revalidatePath("/admin/foretag/directory");
  if (result.slug) revalidatePath(`/foretag/listad/${result.slug}`);
  redirect(`/admin/foretag/directory?publish=${encodeURIComponent(result.code)}`);
}
