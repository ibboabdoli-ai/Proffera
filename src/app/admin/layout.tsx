import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminNavigation } from "@/components/admin/admin-navigation";
import { canAccessAdminArea, resolveAdminArea } from "@/lib/admin-navigation";
import { getPlatformAdmin } from "@/lib/platform-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");

  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-proffera-admin-path") ?? "/admin";
  const area = resolveAdminArea(pathname);
  if (!canAccessAdminArea(admin.role, area)) redirect("/admin/saas?denied=1");

  return (
    <>
      <AdminNavigation role={admin.role} email={admin.email} />
      {children}
    </>
  );
}
