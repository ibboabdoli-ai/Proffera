"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PLATFORM_ADMIN_ROLES, upsertPlatformAdmin } from "@/lib/platform-admin-management";
import type { PlatformAdminRole } from "@/lib/platform-admin";

export async function savePlatformAdminAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const role = String(formData.get("role") ?? "") as PlatformAdminRole;
  const isActive = formData.get("isActive") === "on";

  if (!PLATFORM_ADMIN_ROLES.includes(role)) throw new Error("Invalid role");
  await upsertPlatformAdmin(email, role, isActive);
  revalidatePath("/admin/platform-admins");
  revalidatePath("/admin/audit");
  redirect("/admin/platform-admins?saved=1");
}
