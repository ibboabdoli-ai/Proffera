import Link from "next/link";
import { mainNav, siteConfig } from "@/lib/site";

const legalLinks = [
  { label: "Integritetspolicy", href: "/integritetspolicy" },
  { label: "Villkor", href: "/villkor" },
  { label: "Cookies", href: "/cookies" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-[#dfe5dd] bg-[#102a1c] text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <p className="text-xl font-bold">{siteConfig.name}</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/75">
            En svensk SaaS-plattform för tjänsteföretag som vill hantera leads, bokningar, kunder och AI-driven kommunikation i ett smartare flöde.
          </p>
          <p className="mt-4 text-xs text-white/55">
            Byggs stegvis för små företag i Sverige.
          </p>
        </div>

        <div>
          <p className="font-semibold">Navigering</p>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-semibold">Juridiskt</p>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Proffera. Alla rättigheter förbehållna.
      </div>
    </footer>
  );
}
