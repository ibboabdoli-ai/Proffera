import Link from "next/link";
import { chatLinks, mainNav, siteConfig } from "@/lib/site";
import { ButtonLink } from "@/components/ui/button-link";

export function Header() {
  return (
    <header className="border-b border-[#dfe5dd] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-[#17452f]" aria-label="Proffera startsida">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17452f] text-white">P</span>
          <span>{siteConfig.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-[#344139] lg:flex" aria-label="Huvudmeny">
          {mainNav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[#17452f]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <Link href={chatLinks.app} className="text-sm font-semibold text-[#17452f] hover:text-[#0e2e1e]">
            Logga in
          </Link>
          <ButtonLink href={chatLinks.demo}>{siteConfig.primaryCta}</ButtonLink>
        </div>

        <ButtonLink href={chatLinks.demo} className="sm:hidden">
          Demo
        </ButtonLink>
      </div>
    </header>
  );
}
