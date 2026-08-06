import "server-only";

import { redirect } from "next/navigation";

import { canAccessAdminArea, type AdminArea } from "@/lib/admin-access-policy";
import { getPlatformAdmin } from "@/lib/platform-admin";

export async function getAdminForArea(area: AdminArea) {
  const admin = await getPlatformAdmin();
  if (!admin || !canAccessAdminArea(admin.role, area)) return null;
  return admin;
}

export async function requireAdminArea(area: AdminArea) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");
  if (!canAccessAdminArea(admin.role, area)) redirect("/admin/saas");
  return admin;
}
