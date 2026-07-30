import Link from "next/link";
import { getPublicNavigation, localeCopy, type PublicLocale } from "@/lib/public-locale";
import { siteConfig } from "@/lib/site";

type FooterProps = {
  locale: PublicLocale;
};

export function Footer({ locale }: FooterProps) {
  const copy = localeCopy[locale];
  const navigation = getPublicNavigation(locale);

  return (
    <footer className="border-t border-[#0c2116] bg-[#102a1c] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_0.75fr_0.75fr] lg:px-8">
        <div>
          <p className="text-2xl font-bold tracking-tight">{siteConfig.name}</p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            {copy.footerDescription}
          </p>
          <p className="mt-5 text-xs font-medium uppercase tracking-[0.16em] text-white/45">
            {copy.footerStatus}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold">{copy.footerNavigation}</p>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition hover:text-white focus:outline-none focus-visible:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">{copy.footerLegal}</p>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            {copy.legalLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition hover:text-white focus:outline-none focus-visible:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/55">
        © {new Date().getFullYear()} Proffera. {copy.copyright}
      </div>
    </footer>
  );
}
