import type { PlatformAdminRole } from "@/lib/platform-admin";

export type AdminArea =
  | "saas"
  | "workspaces"
  | "billing"
  | "platform_admins"
  | "audit"
  | "quote_admin";

export type AdminNavigationItem = {
  area: AdminArea;
  label: string;
  href: string;
};

export const ADMIN_NAVIGATION_ITEMS: readonly AdminNavigationItem[] = [
  { area: "saas", label: "SaaS Dashboard", href: "/admin/saas" },
  { area: "workspaces", label: "Workspaces", href: "/admin/workspaces" },
  { area: "billing", label: "Billing", href: "/admin/billing" },
  { area: "platform_admins", label: "Platform Admins", href: "/admin/platform-admins" },
  { area: "audit", label: "Audit Log", href: "/admin/audit" },
  { area: "quote_admin", label: "Quote Admin", href: "/admin" },
] as const;

const ROLE_AREAS: Record<PlatformAdminRole, readonly AdminArea[]> = {
  super_admin: ["saas", "workspaces", "billing", "platform_admins", "audit", "quote_admin"],
  support_admin: ["saas", "workspaces", "audit"],
  billing_admin: ["saas", "workspaces", "billing", "audit"],
  operations_admin: ["saas", "workspaces", "audit", "quote_admin"],
  read_only_admin: ["saas", "workspaces", "audit"],
  developer_admin: ["saas", "workspaces", "audit", "quote_admin"],
};

export function canAccessAdminArea(role: PlatformAdminRole, area: AdminArea) {
  return ROLE_AREAS[role].includes(area);
}

export function getAdminNavigationItems(role: PlatformAdminRole) {
  return ADMIN_NAVIGATION_ITEMS.filter((item) => canAccessAdminArea(role, item.area));
}

export function resolveAdminArea(pathname: string): AdminArea {
  if (pathname === "/admin/saas" || pathname.startsWith("/admin/saas/")) return "saas";
  if (pathname === "/admin/workspaces" || pathname.startsWith("/admin/workspaces/")) return "workspaces";
  if (pathname === "/admin/billing" || pathname.startsWith("/admin/billing/")) return "billing";
  if (pathname === "/admin/platform-admins" || pathname.startsWith("/admin/platform-admins/")) return "platform_admins";
  if (pathname === "/admin/audit" || pathname.startsWith("/admin/audit/")) return "audit";
  return "quote_admin";
}
