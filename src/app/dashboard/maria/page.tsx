import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ExternalLink, Settings2, ShieldCheck } from "lucide-react";

import { getDashboardWorkspaceServices } from "@/lib/workspace-services-db";
import { getDashboardWorkspaceBookingHours } from "@/lib/workspace-booking-hours-db";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { saveMariaYearAction } from "./actions";

export const dynamic = "force-dynamic";
const expectedSlug = "makeup-by-maria";
const expectedKeys = [
  "maria-bridal-trial-2026",
  "maria-bridal-without-trial-2026",
];

export default async function MariaSiteDashboardPage({ searchParams }: { searchParams?: Promise<{ updated?: string; error?: string }> }) {
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
  const q = (await searchParams) ?? {};
  const availableYears = Array.from({ length: 11 }, (_, i) => 2026 + i);
  const savedYears = new Set(
    services.flatMap((service) => {
      const match = /^maria-bridal-(?:trial|without-trial)-(20[2-3][0-9])$/.exec(service.publicSlug);
      const year = Number(match?.[1] ?? 0);
      return match && availableYears.includes(year) ? [year] : [];
    }),
  );
  const displayedYears = availableYears.filter((year) => year <= 2028 || savedYears.has(year));
  const missingYears = availableYears.filter((year) => !displayedYears.includes(year));
  const savedPackage = (year: number, kind: "trial" | "without-trial") =>
    services.find((item) => item.publicSlug === `maria-bridal-${kind}-${year}`);
  const savedPrice = (year: number, kind: "trial" | "without-trial") => {
    const service = savedPackage(year, kind);
    return service?.priceType === "fixed" && service.priceAmountMinor !== null
      ? String(service.priceAmountMinor / 100)
      : "";
  };
  const isYearEnabled = (year: number) => {
    const trial = savedPackage(year, "trial");
    const without = savedPackage(year, "without-trial");
    return !trial && !without ? year <= 2028 : Boolean(trial?.isActive && without?.isActive);
  };

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


      <section className="rounded-2xl border border-[#e8d9dc] bg-white p-6 sm:p-8">
        <h2 className="font-serif text-2xl text-[#352a2c]">Bröllopsår och paketpriser</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#705f65]">
          Ändra priset för varje bröllopsår och paket. Ett tomt pris betyder &quot;Pris på förfrågan&quot;.
          Avmarkera ett år för att dölja det i förhandsvisningen. Inga riktiga bokningar aktiveras.
        </p>
        {q.updated ? (
          <p role="status" className="mt-4 rounded-lg bg-[#ecf7f0] px-4 py-3 text-sm font-semibold text-[#256947]">År {q.updated} har sparats.</p>
        ) : null}
        {q.error ? (
          <p role="alert" className="mt-4 rounded-lg bg-[#fff0ee] px-4 py-3 text-sm font-semibold text-[#9d3333]">
            Inställningen kunde inte sparas ({q.error}). Kontrollera pris och behörighet.
          </p>
        ) : null}
        <div className="mt-6 space-y-4">
          {displayedYears.map((year) => (
            <form key={year} action={saveMariaYearAction} className="rounded-xl border border-[#e6d7db] bg-[#fefafa] p-4 sm:p-5">
              <input type="hidden" name="year" value={year} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-serif text-2xl text-[#51313e]">{year}</h3>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#795464]">
                  <input type="checkbox" name="enabled" defaultChecked={isYearEnabled(year)}
                    className="h-4 w-4 accent-[#845363]" />
                  Visa år
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold text-[#634853]">
                  Brudsmink med prov · SEK
                  <input type="number" name="trial" min="0" max="250000" step="1" inputMode="numeric"
                    defaultValue={savedPrice(year, "trial")}
                    placeholder="Pris på förfrågan"
                    className="min-h-11 w-full rounded-lg border border-[#d8c4cb] bg-white px-3 text-sm text-[#352a2c]" />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-[#634853]">
                  Brudsmink utan prov · SEK
                  <input type="number" name="without" min="0" max="250000" step="1" inputMode="numeric"
                    defaultValue={savedPrice(year, "without-trial")}
                    placeholder="Pris på förfrågan"
                    className="min-h-11 w-full rounded-lg border border-[#d8c4cb] bg-white px-3 text-sm text-[#352a2c]" />
                </label>
              </div>
              <button type="submit" className="mt-4 min-h-11 rounded-lg bg-[#845363] px-5 text-xs font-bold text-white hover:bg-[#6d3e4e]">
                Spara {year}
              </button>
            </form>
          ))}
        </div>
        {missingYears.length ? (
          <form action={saveMariaYearAction} className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-[#d7b9c3] p-4">
            <input type="hidden" name="enabled" value="on" />
            <label className="grid gap-1 text-xs font-semibold text-[#634853]">
              Lägg till bröllopsår
              <select name="year" className="min-h-11 rounded-lg border border-[#d8c4cb] bg-white px-3 text-sm">
                {missingYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <button type="submit" className="min-h-11 rounded-lg border border-[#845363] px-5 text-xs font-bold text-[#845363]">
              Lägg till år
            </button>
          </form>
        ) : null}
      </section>

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
