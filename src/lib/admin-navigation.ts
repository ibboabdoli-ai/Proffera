import type { PlatformAdminRole } from "@/lib/platform-admin";

export type AdminArea =
  | "saas"
  | "operations"
  | "workspaces"
  | "company_admin"
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
  { area: "operations", label: "Operations Health", href: "/admin/status" },
  { area: "workspaces", label: "Workspaces", href: "/admin/workspaces" },
  { area: "company_admin", label: "Företag", href: "/admin/foretag" },
  { area: "billing", label: "Billing", href: "/admin/billing" },
  { area: "platform_admins", label: "Platform Admins", href: "/admin/platform-admins" },
  { area: "audit", label: "Audit Log", href: "/admin/audit" },
  { area: "quote_admin", label: "Quote Admin", href: "/admin" },
] as const;

const ROLE_AREAS: Record<PlatformAdminRole, readonly AdminArea[]> = {
  super_admin: ["saas", "operations", "workspaces", "company_admin", "billing", "platform_admins", "audit", "quote_admin"],
  support_admin: ["saas", "operations", "workspaces", "audit"],
  billing_admin: ["saas", "operations", "workspaces", "billing", "audit"],
  operations_admin: ["saas", "operations", "workspaces", "audit", "quote_admin"],
  read_only_admin: ["saas", "operations", "workspaces", "audit"],
  developer_admin: ["saas", "operations", "workspaces", "audit", "quote_admin"],
};

export function canAccessAdminArea(role: PlatformAdminRole, area: AdminArea) {
  return ROLE_AREAS[role].includes(area);
}

export function canAccessCompanyAdmin(role: PlatformAdminRole) {
  return role === "super_admin";
}

export function getAdminNavigationItems(role: PlatformAdminRole) {
  return ADMIN_NAVIGATION_ITEMS.filter((item) => canAccessAdminArea(role, item.area));
}

function matchesAdminRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function resolveAdminArea(pathname: string): AdminArea | null {
  if (pathname === "/admin") return "quote_admin";
  if (matchesAdminRoute(pathname, "/admin/saas")) return "saas";
  if (matchesAdminRoute(pathname, "/admin/status")) return "operations";
  if (matchesAdminRoute(pathname, "/admin/workspaces")) return "workspaces";
  if (matchesAdminRoute(pathname, "/admin/support")) return "workspaces";
  if (matchesAdminRoute(pathname, "/admin/foretag")) return "company_admin";
  if (matchesAdminRoute(pathname, "/admin/billing")) return "billing";
  if (matchesAdminRoute(pathname, "/admin/platform-admins")) return "platform_admins";
  if (matchesAdminRoute(pathname, "/admin/audit")) return "audit";
  if (matchesAdminRoute(pathname, "/admin/marketplace")) return "quote_admin";
  if (matchesAdminRoute(pathname, "/admin/matchning")) return "quote_admin";
  if (matchesAdminRoute(pathname, "/admin/skicka-lead")) return "quote_admin";
  if (matchesAdminRoute(pathname, "/admin/leverans")) return "quote_admin";
  return null;
}
