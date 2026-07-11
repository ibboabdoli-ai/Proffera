import Image from "next/image";
import Link from "next/link";
import { mainNav, siteConfig } from "@/lib/site";
import { ButtonLink } from "@/components/ui/button-link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#dfe5dd]/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="Proffera startsida">
          <Image
            src="/brand/proffera-logo.svg"
            alt="Proffera"
            width={184}
            height={48}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-[#526057] lg:flex" aria-label="Huvudmeny">
          {mainNav.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-[#17452f] focus:outline-none focus-visible:text-[#17452f]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <Link href="/logga-in" className="text-sm font-semibold text-[#17452f] transition hover:text-[#0e2e1e] focus:outline-none focus-visible:text-[#0e2e1e]">
            Logga in
          </Link>
          <ButtonLink href="/demo">{siteConfig.primaryCta}</ButtonLink>
        </div>

        <details className="relative lg:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center rounded-xl border border-[#d7ded5] px-4 text-sm font-semibold text-[#17452f] marker:hidden transition hover:bg-[#eef5ef] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17452f]">
            Meny
          </summary>
          <div className="absolute right-0 top-[3.25rem] w-72 rounded-2xl border border-[#dfe5dd] bg-white p-3 shadow-xl shadow-[#102a1c]/10">
            <nav className="grid gap-1" aria-label="Huvudmeny mobil">
              {mainNav.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-xl px-3 py-2.5 text-sm font-medium text-[#344139] transition hover:bg-[#f2f6f2] hover:text-[#17452f]">
                  {item.label}
                </Link>
              ))}
              <Link href="/logga-in" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[#17452f] transition hover:bg-[#f2f6f2]">
                Logga in
              </Link>
              <ButtonLink href="/demo" className="mt-2 w-full">
                {siteConfig.primaryCta}
              </ButtonLink>
            </nav>
          </div>
        </details>
      </div>
    </header>
  );
}
