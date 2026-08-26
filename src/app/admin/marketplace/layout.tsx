import type { ReactNode } from "react";
import Link from "next/link";

export default function MarketplaceAdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav aria-label="Marketplace admin" className="mx-auto flex max-w-7xl gap-3 px-4 pt-6 sm:px-6 lg:px-8">
        <Link className="text-sm font-semibold text-[#17452f] underline-offset-4 hover:underline" href="/admin/marketplace">
          Gästförfrågningar
        </Link>
        <Link className="text-sm font-semibold text-[#17452f] underline-offset-4 hover:underline" href="/admin/marketplace/funnel">
          Funnel 30 dagar
        </Link>
      </nav>
      {children}
    </>
  );
}
