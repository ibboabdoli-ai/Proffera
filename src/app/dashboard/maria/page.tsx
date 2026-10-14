import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ExternalLink, Settings2, ShieldCheck } from "lucide-react";

import { getDashboardWorkspaceServices } from "@/lib/workspace-services-db";
import { getDashboardWorkspaceBookingHours } from "@/lib/workspace-booking-hours-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";
const expectedSlug = "makeup-by-maria";
const expectedKeys = [
  "maria-bridal-trial-2026",
  "maria-bridal-without-trial-2026",
];

export default async function MariaSiteDashboardPage() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || access.workspaceSlug !== expectedSlug || !canManageWorkspaceSettings(access)) {
    redirect("/dashboard");
  }

  const [services, bookingHours] = await Promise.all([
    getDashboardWorkspaceServices(),
    getDashboardWorkspaceBookingHours(),
  ]);
  const packages = expectedKeys.map((slug) =>
    services.find((service) => service.publicSlug === slug) ?? null,
  );
  const weekendHours = bookingHours.hours.filter((hour) => [5, 6].includes(hour.weekday));
  const formatPrice = (price: number | null) =>
    price === null ? "Ej angivet" : `${new Intl.NumberFormat("sv-SE").format(price)} kr`;

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-[#e8d9dc] bg-[#fcf9f8] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#966676]">Makeup by Maria · Södertälje</p>
        <h1 className="mt-2 font-serif text-3xl text-[#352a2c] sm:text-4xl">Marias webbplats</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#705f65]">
          Design 02 är kundens val. Tjänsterna och tiderna nedan hämtas från
          arbetsytan. Enbart behöriga administratörer kan förhandsvisa
          tjänsteutkast. Den publika bokningen är inte aktiverad.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/demo/makeup-by-maria-v2.html" target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#845363] px-4 py-2 text-sm font-bold text-white">
            Öppna design 02 <ExternalLink size={16} />
          </Link>
          <Link href="/dashboard/installningar#tjanster"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#bfa1a9] px-4 py-2 text-sm font-bold text-[#754b5a]">
            Redigera tjänster <Settings2 size={16} />
          </Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {packages.map((item, index) => (
          <div key={expectedKeys[index]} className="rounded-2xl border border-[#e8d9dc] bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-[#986d7a]">Brudmakeup 2026 · {index + 1}</p>
            <h2 className="mt-3 font-serif text-2xl text-[#352a2c]">{item?.name ?? "Tjänsten saknas"}</h2>
            <p className="mt-2 text-sm text-[#826f75]">{item?.shortDescription ?? "Skapa tjänsten från inställningarna."}</p>
            <p className="mt-5 text-2xl font-bold text-[#79495a]">
              {formatPrice(item?.priceAmountMinor != null ? item.priceAmountMinor / 100 : item?.basePriceSek ?? null)}
            </p>
            <p className="mt-2 text-xs text-[#826f75]">
              {item?.publicStatus === "published" ? "Publicerad tjänst" : "Endast utkast"}
              {" · "} Tjänstens längd: {item?.durationMinutes ? `${item.durationMinutes} min` : "inte fastställd"}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#e8d9dc] bg-white p-6">
        <h2 className="flex items-center gap-2 font-serif text-2xl text-[#352a2c]"><CalendarDays size={20} /> Bokningstider</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {weekendHours.map((hour) => (
            <div key={hour.weekday} className="rounded-xl bg-[#fcf6f5] p-4 text-sm text-[#49383e]">
              <span className="font-semibold">{hour.weekday === 5 ? "Fredag" : "Lördag"}:</span>{" "}
              {hour.isClosed ? "Stängt" : `${hour.opensAt}–${hour.closesAt}`}
            </div>
          ))}
        </div>
        <Link href="/dashboard/installningar"
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#bfa1a9] px-4 py-2 text-sm font-bold text-[#754b5a]">
          Ändra tider i inställningar <Settings2 size={16} />
        </Link>
      </section>

      <section className="flex items-start gap-3 rounded-xl border border-[#dec6cd] bg-[#fbf0ef] p-5 text-sm text-[#684956]">
        <ShieldCheck className="mt-1 shrink-0" size={20} />
        <div>
          <strong>Endast intern förhandsvisning.</strong>
          <p className="mt-1 leading-6">
            Designen skickar inte bokningar eller kunduppgifter. Priser för 2027/2028,
            tjänsternas längd och Marias framtida ägaråtkomst behöver bekräftas innan lansering.
            Domän och riktiga kundnotiser är inte aktiverade.
          </p>
        </div>
      </section>
    </main>
  );
}
