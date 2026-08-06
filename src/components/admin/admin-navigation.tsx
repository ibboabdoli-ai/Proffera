import Link from "next/link";

import { getAdminNavigationItems } from "@/lib/admin-navigation";
import type { PlatformAdminRole } from "@/lib/platform-admin";

export function AdminNavigation({ role, email }: { role: PlatformAdminRole; email: string }) {
  const items = getAdminNavigationItems(role);

  return (
    <div className="border-b border-slate-200 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Proffera Platform Admin</p>
          <p className="truncate text-xs text-slate-300">{email} · {role}</p>
        </div>
        <nav className="flex flex-wrap gap-2" aria-label="Platform admin navigation">
          {items.map((item) => (
            <Link key={item.area} href={item.href} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-900">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
