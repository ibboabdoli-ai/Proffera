import type { PlatformAdminRole } from "@/lib/platform-admin";

export type AdminArea =
  | "saas"
  | "workspaces"
  | "billing"
  | "platform_admins"
  | "audit"
  | "quote"
  | "company";

export type AdminNavigationItem = {
  area: Exclude<AdminArea, "company">;
  href: string;
  label: string;
};

const CORE_ADMIN_ROLES: PlatformAdminRole[] = [
  "super_admin",
  "support_admin",
  "billing_admin",
  "operations_admin",
  "read_only_admin",
  "developer_admin",
];

const AREA_ROLES: Record<AdminArea, PlatformAdminRole[]> = {
  saas: CORE_ADMIN_ROLES,
  workspaces: CORE_ADMIN_ROLES,
  billing: ["super_admin", "billing_admin"],
  platform_admins: ["super_admin"],
  audit: CORE_ADMIN_ROLES,
  quote: ["super_admin", "operations_admin"],
  company: ["super_admin"],
};

export const ADMIN_NAVIGATION_ITEMS: AdminNavigationItem[] = [
  { area: "saas", href: "/admin/saas", label: "SaaS dashboard" },
  { area: "workspaces", href: "/admin/workspaces", label: "Workspaces" },
  { area: "billing", href: "/admin/billing", label: "Billing" },
  { area: "platform_admins", href: "/admin/platform-admins", label: "Platform admins" },
  { area: "audit", href: "/admin/audit", label: "Audit log" },
  { area: "quote", href: "/admin", label: "Quote admin" },
];

export function canAccessAdminArea(role: PlatformAdminRole, area: AdminArea) {
  return AREA_ROLES[area].includes(role);
}

export function getAdminNavigationItems(role: PlatformAdminRole) {
  return ADMIN_NAVIGATION_ITEMS.filter((item) => canAccessAdminArea(role, item.area));
}
