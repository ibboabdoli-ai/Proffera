import type { ReactNode } from "react";
import Link from "next/link";

import DirectoryLowConfidenceRefreshButton from "./DirectoryLowConfidenceRefreshButton";

const adminLinks = [
  { href: "/admin/foretag/directory", label: "Directory" },
  { href: "/admin/foretag/directory/scb", label: "SCB" },
  { href: "/admin/foretag/directory/details", label: "Fullständigt underlag" },
];

export default function DirectoryAdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="border-b border-black/5 bg-white px-4 py-3 sm:px-6 lg:px-8" aria-label="Directory admin">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
          {adminLinks.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex min-h-9 items-center rounded-lg border border-[#dfe5dd] px-3 text-xs font-black text-[#17452f] transition hover:bg-[#eef4ef]">
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
      <div className="mx-4 mb-6 lg:fixed lg:bottom-4 lg:right-4 lg:z-50 lg:mx-0 lg:mb-0 lg:w-[min(30rem,calc(100vw-2rem))]">
        <DirectoryLowConfidenceRefreshButton />
      </div>
    </>
  );
}
