import Link from "next/link";
import { LockKeyhole } from "lucide-react";

import type { ProfferaModuleId } from "@/lib/proffera-modules";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

export async function DashboardModuleGuard({ children, moduleId }: Readonly<{ children: React.ReactNode; moduleId: ProfferaModuleId }>) {
  const hasAccess = await hasDashboardModuleAccess(moduleId);

  if (hasAccess) return children;

  return (
    <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)] sm:p-8">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f1f2ef] text-[#4e5c53]"><LockKeyhole className="h-5 w-5" aria-hidden="true" /></span>
      <h2 className="mt-5 text-2xl font-bold tracking-tight text-[#17201a]">Modulen är inte aktiverad</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5b665f]">Den här modulen ingår inte i arbetsytans nuvarande åtkomst. Kontakta Proffera om modulen ska aktiveras.</p>
      <Link href="/dashboard/installningar" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d7dfd5] bg-[#f7f9f6] px-4 py-2.5 text-sm font-bold text-[#17452f] transition hover:border-[#bdcbb9] hover:bg-[#eef4ef]">Visa modulstatus</Link>
    </section>
  );
}
