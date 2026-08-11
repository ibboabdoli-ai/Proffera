import "server-only";

import { redirect } from "next/navigation";

import {
  canAccessAdminArea,
  canAccessCompanyAdmin,
  type AdminArea,
} from "@/lib/admin-navigation";
import { getPlatformAdmin } from "@/lib/platform-admin";

export async function getAdminForArea(area: AdminArea) {
  const admin = await getPlatformAdmin();
  if (!admin || !canAccessAdminArea(admin.role, area)) return null;
  return admin;
}

export async function requireAdminArea(area: AdminArea) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");
  if (!canAccessAdminArea(admin.role, area)) redirect("/admin/saas?denied=1");
  return admin;
}

export async function getCompanyAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin || !canAccessCompanyAdmin(admin.role)) return null;
  return admin;
}

export async function requireCompanyAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");
  if (!canAccessCompanyAdmin(admin.role)) redirect("/admin/saas?denied=1");
  return admin;
}

export async function requireSuperAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");
  if (admin.role !== "super_admin") redirect("/admin/saas?denied=1");
  return admin;
}
