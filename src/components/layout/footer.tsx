import Link from "next/link";
import { mainNav, siteConfig } from "@/lib/site";

const legalLinks = [
  { label: "Integritetspolicy", href: "/integritetspolicy" },
  { label: "Villkor", href: "/villkor" },
  { label: "Cookies", href: "/cookies" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-[#0c2116] bg-[#102a1c] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_0.75fr_0.75fr] lg:px-8">
        <div>
          <p className="text-2xl font-bold tracking-tight">{siteConfig.name}</p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
            En svensk SaaS-plattform för tjänsteföretag som vill hantera leads, bokningar och kunder i ett tydligt arbetsflöde.
          </p>
          <p className="mt-5 text-xs font-medium uppercase tracking-[0.16em] text-white/45">
            Byggs stegvis för små företag i Sverige.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold">Navigering</p>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition hover:text-white focus:outline-none focus-visible:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold">Juridiskt</p>
          <ul className="mt-4 space-y-3 text-sm text-white/70">
            {legalLinks.map((item) => (
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
        © {new Date().getFullYear()} Proffera. Alla rättigheter förbehållna.
      </div>
    </footer>
  );
}
