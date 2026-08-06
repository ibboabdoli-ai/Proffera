import Link from "next/link";

import { getAdminNavigationItems } from "@/lib/admin-access-policy";
import type { PlatformAdminRole } from "@/lib/platform-admin";

export function AdminNavigation({
  role,
  email,
}: {
  role: PlatformAdminRole;
  email: string;
}) {
  const items = getAdminNavigationItems(role);

  return (
    <div className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/admin/saas" className="text-sm font-bold uppercase tracking-[0.16em] text-slate-950">
            Proffera Admin
          </Link>
          <p className="text-xs text-slate-500">
            {email} · {role}
          </p>
        </div>
        <nav aria-label="Platform administration" className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Link
              key={item.area}
              href={item.href}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
