import Link from "next/link";

import { requireCompanyAdmin } from "@/lib/admin-authorization";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireCompanyAdmin();

  return (
    <>
      <div className="border-b border-[#dfe5dd] bg-white px-4 py-3 sm:px-6 lg:px-8">
        <nav className="mx-auto flex max-w-6xl flex-wrap gap-2" aria-label="Företagsadministration">
          <Link className="rounded-xl px-3 py-2 text-sm font-bold text-[#17452f] hover:bg-[#eef5ef]" href="/admin/foretag">
            Kundkonton
          </Link>
          <Link className="rounded-xl px-3 py-2 text-sm font-bold text-[#17452f] hover:bg-[#eef5ef]" href="/admin/foretag/directory">
            Directory Engine
          </Link>
          <Link className="rounded-xl px-3 py-2 text-sm font-bold text-[#17452f] hover:bg-[#eef5ef]" href="/admin/foretag/directory/preview">
            Källtest
          </Link>
          <Link className="rounded-xl px-3 py-2 text-sm font-bold text-[#17452f] hover:bg-[#eef5ef]" href="/admin/foretag/claims">
            Anspråk
          </Link>
        </nav>
      </div>
      {children}
    </>
  );
}
