import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireAdminArea } from "@/lib/admin-authorization";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminArea("saas");

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNavigation role={admin.role} email={admin.email} />
      {children}
    </div>
  );
}
