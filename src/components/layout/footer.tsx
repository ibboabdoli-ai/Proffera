import Image from "next/image";
import Link from "next/link";
import { getPublicNavigation, localeCopy, type PublicLocale } from "@/lib/public-locale";
import { siteConfig } from "@/lib/site";

type FooterProps = {
  locale: PublicLocale;
  marketplace?: boolean;
};

const marketplaceFooter = {
  sv: {
    description: "Hitta företag, boka tid eller begär offert utifrån tjänsten du behöver och platsen där jobbet ska utföras.",
    status: "För kunder som söker hjälp – och företag som vill bli valda.",
    navigation: [
      { label: "Hitta företag", href: "/foretag/listad" },
      { label: "Populära tjänster", href: "/#populara-tjanster" },
      { label: "Så fungerar det", href: "/#sa-fungerar" },
      { label: "För företag", href: "/for-foretag" },
      { label: "Om oss", href: "/om" },
    ],
  },
  en: {
    description: "Find businesses, book an appointment or request a quote based on the service you need and where the work should be done.",
    status: "For customers looking for help – and businesses that want to be chosen.",
    navigation: [
      { label: "Find businesses", href: "/en/companies" },
      { label: "Popular services", href: "/en#populara-tjanster" },
      { label: "How it works", href: "/en#sa-fungerar" },
      { label: "For businesses", href: "/en/for-business" },
      { label: "About us", href: "/en/about" },
    ],
  },
} as const;

export function Footer({ locale, marketplace = false }: FooterProps) {
  const copy = localeCopy[locale];
  const marketplaceCopy = marketplace ? marketplaceFooter[locale] : null;
  const navigation = marketplaceCopy?.navigation ?? getPublicNavigation(locale);
  const description = marketplaceCopy?.description ?? copy.footerDescription;
  const status = marketplaceCopy?.status ?? copy.footerStatus;

  const footerClass = marketplace
    ? "border-t border-[#dce4ee] bg-white text-[#11213b]"
    : "border-t border-[#082654] bg-[#0a2e63] text-white";
  const secondaryText = marketplace ? "text-[#66758a]" : "text-white/70";
  const tertiaryText = marketplace ? "text-[#7b8799]" : "text-white/55";
  const linkClass = marketplace
    ? "transition hover:text-[#1469d8] focus:outline-none focus-visible:text-[#1469d8]"
    : "transition hover:text-white focus:outline-none focus-visible:text-white";
  const dividerClass = marketplace ? "border-[#dce4ee]" : "border-white/10";

  return (
    <footer className={footerClass}>
      <div className={`mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-[1.5fr_0.75fr_0.75fr] lg:px-8 ${marketplace ? "py-9" : "py-12"}`}>
        <div>
          <Image
            src={marketplace ? "/brand/proffera-logo.svg" : "/brand/proffera-logo-light.svg"}
            alt={siteConfig.name}
            width={184}
            height={48}
            className={marketplace ? "h-7 w-auto" : "h-8 w-auto"}
          />
          <p className={`mt-4 max-w-sm text-sm leading-6 ${secondaryText}`}>
            {description}
          </p>
          <p className={`mt-5 text-xs font-medium uppercase tracking-[0.16em] ${tertiaryText}`}>
            {status}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold">{copy.footerNavigation}</p>
          <ul className={`mt-4 space-y-3 text-sm ${secondaryText}`}>
            {navigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">{copy.footerLegal}</p>
          <ul className={`mt-4 space-y-3 text-sm ${secondaryText}`}>
            {copy.legalLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={`border-t ${dividerClass} px-4 py-5 text-center text-xs ${marketplace ? "text-[#7b8799]" : "text-white/55"}`}>
        © {new Date().getFullYear()} Proffera. {copy.copyright}
      </div>
    </footer>
  );
}
