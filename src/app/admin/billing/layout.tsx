import Link from "next/link";
import { redirect } from "next/navigation";

import { canAccessAdminBilling } from "@/lib/admin-billing";
import { getPlatformAdmin } from "@/lib/platform-admin";

export default async function AdminBillingLayout({ children }: { children: React.ReactNode }) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");
  if (!canAccessAdminBilling(admin.role)) redirect("/admin/saas");

  return (
    <>
      <div className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-2 px-4 py-3 text-sm font-semibold sm:px-6 lg:px-8" aria-label="Billing navigation">
          <Link href="/admin/billing" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Billing overview</Link>
          <Link href="/admin/billing/alerts" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Trial & payment alerts</Link>
        </nav>
      </div>
      {children}
    </>
  );
}
