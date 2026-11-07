import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CalendarOff, ExternalLink, Settings2, ShieldCheck } from "lucide-react";

import { getDashboardWorkspaceServices } from "@/lib/workspace-services-db";
import { getDashboardWorkspaceBookingHours } from "@/lib/workspace-booking-hours-db";
import { getMariaPreviewBookingReadiness } from "@/lib/maria-preview-booking";
import { readMariaCardTranslations } from "@/lib/maria-card-translations-db";
import { mariaDefaultCardCopy } from "@/lib/maria-default-card-copy";
import { isMariaProductionYearEditorReady } from "@/lib/maria-production-year-editor";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { saveMariaYearAction } from "./actions";
import { saveMariaProductionYearAction } from "./production-year-actions";
import { saveMariaScheduleAction } from "./schedule-actions";

export const dynamic = "force-dynamic";
const expectedSlug = "makeup-by-maria";
const expectedKeys = [
  "maria-bridal-trial-2026",
  "maria-bridal-without-trial-2026",
];

export default async function MariaSiteDashboardPage({ searchParams }: { searchParams?: Promise<{ updated?: string; error?: string; year?: string; lang?: string | string[] }> }) {
  const access = await getUserWorkspaceAccess();
  const isPreview = process.env.VERCEL_ENV === "preview";
  const isProduction = process.env.VERCEL_ENV === "production";
  if ((!isPreview && !isProduction) || !access.ok || access.workspaceSlug !== expectedSlug || !canManageWorkspaceSettings(access)) {
    redirect("/dashboard");
  }

  const [services, bookingHours, bookingReadiness, cardTranslations] = await Promise.all([
    // When the Production editor is enabled, never render editable default
    // values if the existing services could not be fetched reliably.
    getDashboardWorkspaceServices({
      strict: isProduction && process.env.PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED === "true",
    }),
    getDashboardWorkspaceBookingHours(),
    getMariaPreviewBookingReadiness(),
    readMariaCardTranslations(access.workspaceId),
  ]);
  const packages = expectedKeys.map((slug) =>
    services.find((service) => service.publicSlug === slug) ?? null,
  );
  const weekendHours = bookingHours.hours.filter((hour) => [0, 5, 6].includes(hour.weekday));
  const q = (await searchParams) ?? {};
  const availableYears = Array.from({ length: 11 }, (_, i) => 2026 + i);
  const editingYear = availableYears.includes(Number(q.year)) ? Number(q.year) : 2026;
  const displayedYears = [editingYear];
  const savedPackage = (year: number, kind: "trial" | "without-trial") =>
    services.find((item) => item.publicSlug === `maria-bridal-${kind}-${year}`);
  const savedCopy = (year: number, kind: "trial" | "without-trial", locale: "sv" | "en" | "ar") => {
    if (locale === "sv") return savedPackage(year, kind)?.shortDescription ?? "";
    return cardTranslations.get(`maria-bridal-${kind}-${year}`)?.[locale] ?? "";
  };
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

  const savedDuration = packages.find(item=>item?.durationMinutes != null)?.durationMinutes ?? 180;
  const savedBuffer = packages.find(item=>item)?.bufferAfterMinutes ?? 0;
  const editHours = [5,6,0].map(day=>{
    const h = weekendHours.find(hour=>hour.weekday===day);
    return {day,first:h?.opensAt?.slice(0,5)??"06:00",last:h?.closesAt?.slice(0,5)??"10:00",closed:h?.isClosed??false};
  });

  const productionEditorReady = isProduction ? await isMariaProductionYearEditorReady() : false;

  // Exactly the same year/price/SV-EN-AR editor in Preview and approved
  // Production; only the server writer differs. Production never renders or
  // submits the year-publication checkbox or booking/calendar controls.
  const renderYearEditor = (contentOnly: boolean) => (
      <section id="priser" className="scroll-mt-6 rounded-2xl border border-[#e8d9dc] bg-white p-4 sm:p-8">
        <h2 className="font-serif text-2xl text-[#352a2c]">Bröllopsår och paketpriser</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#705f65]">
          Välj år och ändra pris och kortbeskrivningar på svenska, engelska och arabiska.
          Varje fält visar den aktuella texten på bokningssidan. Radera ett språkfält och spara för att återställa standardtexten.
          Spara ett år i taget.
          {contentOnly
            ? "Det här ändrar bara paketpris och text. Publicering, bokningar och kalendern ändras inte."
            : "Publicering kräver separat godkännande."}
        </p>
        {q.updated ? (
          <p role="status" className="mt-4 rounded-lg bg-[#ecf7f0] px-4 py-3 text-sm font-semibold text-[#256947]">
            {q.updated === "schedule" ? "Bokningstider och behandlingstid har sparats." : `År ${q.updated} har sparats.`}
          </p>
        ) : null}
        {q.error ? (
          <p role="alert" className="mt-4 rounded-lg bg-[#fff0ee] px-4 py-3 text-sm font-semibold text-[#9d3333]">
            {q.error === "translation_setup"
              ? "Språktexternas lagring är inte aktiverad i denna miljö. Inga ändringar sparades."
              : q.error === "description"
                ? "Kontrollera beskrivningarna (högst 280 tecken per språk) och ladda om sidan vid behov. Inga ändringar sparades."
                : `Inställningen kunde inte sparas (${q.error}). Kontrollera pris och behörighet.`}
          </p>
        ) : null}
        <form method="get" action="/dashboard/maria" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl bg-[#fcf6f5] p-4">
          <label className="grid min-w-[150px] flex-1 gap-2 text-sm font-bold text-[#634853]" htmlFor="maria-year">
            Bröllopsår
            <select id="maria-year" name="year" defaultValue={editingYear}
              className="min-h-12 rounded-lg border border-[#d8c4cb] bg-white px-3 text-base text-[#352a2c]">
              {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <button type="submit" className="min-h-12 rounded-lg bg-[#845363] px-6 text-sm font-bold text-white">
            Visa år
          </button>
        </form>
        <div className="mt-4 space-y-4">
          {displayedYears.map((year) => (
            <form key={year} action={contentOnly ? saveMariaProductionYearAction : saveMariaYearAction} className="rounded-xl border border-[#e6d7db] bg-[#fefafa] p-4 sm:p-5">
              <input type="hidden" name="year" value={year} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-serif text-2xl text-[#51313e]">{year}</h3>
                {contentOnly
                  ? <p className="text-xs font-bold text-[#795464]">Endast pris och text · ingen publicering</p>
                  : (
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-[#795464]">
                      <input type="checkbox" name="enabled" defaultChecked={isYearEnabled(year)}
                        className="h-4 w-4 accent-[#845363]" />
                      Visa år
                    </label>
                  )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold text-[#634853]">
                  Brudsmink med prov · SEK
                  <input type="number" name="trial" min="0" max="250000" step="0.01" inputMode="decimal"
                    defaultValue={savedPrice(year, "trial")}
                    placeholder="Pris på förfrågan"
                    className="min-h-11 w-full rounded-lg border border-[#d8c4cb] bg-white px-3 text-base text-[#352a2c] sm:text-sm" />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-[#634853]">
                  Brudsmink utan prov · SEK
                  <input type="number" name="without" min="0" max="250000" step="0.01" inputMode="decimal"
                    defaultValue={savedPrice(year, "without-trial")}
                    placeholder="Pris på förfrågan"
                    className="min-h-11 w-full rounded-lg border border-[#d8c4cb] bg-white px-3 text-base text-[#352a2c] sm:text-sm" />
                </label>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(["trial", "without-trial"] as const).map(kind => (
                  <div key={kind} className="grid gap-3">
                    <p className="text-sm font-bold text-[#51313e]">
                      {kind === "trial" ? "Brudsmink med prov" : "Brudsmink utan prov"}
                    </p>
                    {([
                      ["sv", "Svenska"],
                      ["en", "English"],
                      ["ar", "العربية"],
                    ] as const).map(([locale, languageLabel]) => (
                      <label key={locale} className="grid gap-1.5 text-xs font-semibold text-[#634853]">
                        {languageLabel}
                        <textarea name={`${kind === "trial" ? "trial" : "without"}_description${locale === "sv" ? "" : `_${locale}`}`}
                          lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} maxLength={280} rows={3}
                          defaultValue={savedCopy(year, kind, locale) || mariaDefaultCardCopy[kind][locale]}
                          placeholder="Lämna tomt och spara för standardtext"
                          className="w-full rounded-lg border border-[#d8c4cb] bg-white px-3 py-2 text-base text-[#352a2c] sm:text-sm" />
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <button type="submit" className="mt-4 min-h-11 rounded-lg bg-[#845363] px-5 text-xs font-bold text-white hover:bg-[#6d3e4e]">
                Spara {year}
              </button>
            </form>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#705f65]">
          {contentOnly
            ? "Välj år 2026–2036. Endast årets priser och beskrivningar ändras. Redan gjorda bokningar behåller sina sparade uppgifter."
            : "Välj valfritt år 2026–2036 ovan. Ändringar syns i den anslutna förhandsvisningen när den öppnas eller uppdateras."}
        </p>
      </section>
  );

  if (isProduction) {
    // The dedicated Maria Production view remains booking/calendar read-only.
    // Price and three-language card copy become editable only after an
    // explicitly enabled, migration-verified Production content gate.
    const packagePrice = (service: (typeof packages)[number]) =>
      service?.priceType === "fixed" && service.priceAmountMinor !== null
        ? `${new Intl.NumberFormat("sv-SE").format(service.priceAmountMinor / 100)} kr`
        : "Pris på förfrågan";

    return (
      <main className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-[#e8d9dc] bg-[#fcf9f8] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#966676]">Makeup by Maria · Södertälje</p>
          <h1 className="mt-2 font-serif text-3xl text-[#352a2c] sm:text-4xl">Min bokningsöversikt</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#705f65]">
            Det här är Marias arbetsyta i Proffera. Onlinebokningen är ännu inte aktiverad.
            {productionEditorReady
              ? "Ändra pris och tre språktexter för valfritt bröllopsår nedan. Inga bokningar eller kalenderinställningar ändras här."
              : "Dina sparade tjänster, priser och arbetstider visas här utan att öppna bokningen för kunder."}
          </p>
          <Link href="/dashboard/installningar"
            className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-[#845363] px-5 py-2 text-sm font-bold text-white">
            Redigera företagsprofil och tjänster
          </Link>
        </header>

        {productionEditorReady ? renderYearEditor(true) : (
          <p role="status" className="rounded-xl border border-[#dec6cd] bg-[#fbf0ef] p-4 text-sm text-[#684956]">
            Årsredigering öppnas efter godkänd databasmigrering och aktivering. Befintliga priser visas nedan utan att ändras.
          </p>
        )}

        <section className="rounded-2xl border border-[#e8d9dc] bg-white p-5 sm:p-8">
          <h2 className="font-serif text-2xl text-[#352a2c]">Bröllopspaket och priser</h2>
          <p className="mt-2 text-sm text-[#705f65]">Aktuella värden från Marias arbetsyta, inte testdatabasen.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {packages.map((service, index) => (
              <article key={index} className="rounded-xl border border-[#e6d7db] bg-[#fefafa] p-5">
                <h3 className="font-serif text-xl text-[#51313e]">
                  {index === 0 ? "Brudsmink med prov" : "Brudsmink utan prov"}
                </h3>
                <p className="mt-3 text-lg font-bold text-[#51313e]">{service ? packagePrice(service) : "Tjänsten saknas"}</p>
                <p className="mt-2 text-sm text-[#705f65]">
                  Behandlingstid: {service?.durationMinutes ?? "–"} min
                </p>
                <p className="mt-2 text-xs font-semibold text-[#795464]">
                  {service?.publicStatus === "published" ? "Publicerad" : "Utkast – inte publicerad"}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8d9dc] bg-white p-5 sm:p-8">
          <h2 className="font-serif text-2xl text-[#352a2c]">Mina arbetstider</h2>
          <p className="mt-2 text-sm text-[#705f65]">
            Tiderna visas för kontroll. Bokning och kalenderändringar aktiveras först vid separat publicering.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {editHours.map((hour) => (
              <div key={hour.day} className="rounded-xl border border-[#e8d9dc] bg-[#fcf9f8] p-4">
                <p className="font-bold text-[#51313e]">
                  {hour.day === 5 ? "Fredag" : hour.day === 6 ? "Lördag" : "Söndag"}
                </p>
                <p className="mt-2 text-sm text-[#705f65]">
                  {hour.closed ? "Stängt" : `${hour.first}–${hour.last} (bokningsstarter)`}
                </p>
              </div>
            ))}
          </div>
        </section>
        <p className="rounded-xl border border-[#dec6cd] bg-[#fbf0ef] p-5 text-sm leading-7 text-[#684956]">
          Onlinebokningen är ännu inte aktiverad. Pris- och textredigering öppnar aldrig
          bokningar, betalningar eller kalendern. Övriga företagsuppgifter hanteras via Inställningar
          tills den kontrollerade lanseringen är godkänd.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-[#e8d9dc] bg-[#fcf9f8] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#966676]">Makeup by Maria · Södertälje</p>
        <h1 className="mt-2 font-serif text-3xl text-[#352a2c] sm:text-4xl">Min bokningsöversikt</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#705f65]">
          Hantera bokningar, arbetstider och priser här. Den anslutna förhandsvisningen
          läser de sparade ändringarna direkt från arbetsytan.
          {bookingReadiness.enabled
            ? "Endast isolerade QA-bokningar är aktiverade i denna Preview."
            : "Den publika bokningen är inte aktiverad."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/demo/makeup-by-maria-v2.html" target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#845363] px-4 py-2 text-sm font-bold text-white">
            Öppna design 02 <ExternalLink size={16} />
          </Link>
          <Link href="/dashboard/bokningar"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#bfa1a9] px-4 py-2 text-sm font-bold text-[#754b5a]">
            Hantera bokningar <CalendarDays size={16} />
          </Link>
          <Link href="/dashboard/maria/kalender"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#bfa1a9] px-4 py-2 text-sm font-bold text-[#754b5a]">
            Hantera dagens tider <CalendarOff size={16} />
          </Link>
          <Link href="#priser"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#bfa1a9] px-4 py-2 text-sm font-bold text-[#754b5a]">
            Priser och texter <Settings2 size={16} />
          </Link>
          <Link href="#tider" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#bfa1a9] px-4 py-2 text-sm font-bold text-[#754b5a]">
            Ändra arbetstider <Settings2 size={16} />
          </Link>
        </div>
      </div>

{renderYearEditor(false)}

      <section id="tider" className="scroll-mt-6 rounded-2xl border border-[#e8d9dc] bg-white p-4 sm:p-8">
        <h2 className="font-serif text-2xl text-[#352a2c]">Mina arbetstider</h2>
        <p className="mt-2 text-sm leading-6 text-[#705f65]">
          Bestäm själv när kunder kan boka på fredag, lördag och söndag.
          Första och sista tiden gäller när en bokning får <strong>starta</strong>.
          Ingen extra paus läggs till om du väljer 0 minuter. Själva bokningen skyddas mot dubbelbokning.
        </p>
        <form action={saveMariaScheduleAction} className="mt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-[#634853]">
              Hur lång tid tar sminkningen?
              <select name="duration_minutes" defaultValue={String(savedDuration)}
                className="min-h-11 w-full rounded-lg border border-[#d8c4cb] bg-white px-3 text-[#352a2c]" required>
                {(!Number.isInteger(savedDuration) || savedDuration < 30 || savedDuration > 720 || savedDuration % 30 !== 0) && (
                  <option value={String(savedDuration)}>{savedDuration} min (sparat värde – välj giltig tid)</option>
                )}
                {Array.from({ length: 24 }, (_, i) => (i + 1) * 30).map(n => (
                  <option key={n} value={n}>
                    {n < 60 ? `${n} min` : `${Math.floor(n / 60)} tim${n % 60 ? ` ${n % 60} min` : ""}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#634853]">
              Paus efter bokning (minuter)
              <select name="buffer_after_minutes" defaultValue={String(savedBuffer)}
                className="min-h-11 w-full rounded-lg border border-[#d8c4cb] px-3 text-[#352a2c]">
                {(!Number.isInteger(savedBuffer) || savedBuffer < 0 || savedBuffer > 120 || savedBuffer % 15 !== 0) && (
                  <option value={String(savedBuffer)}>{savedBuffer} min (sparat värde – välj giltig paus)</option>
                )}
                {[0,15,30,45,60,75,90,105,120].map(n=><option key={n} value={n}>{n} min</option>)}
              </select>
            </label>
          </div>
          <p className="text-xs leading-6 text-[#705f65]">Du väljer själv hur lång tid sminkningen tar. Ändringen gäller nya bokningar. Befintliga bokningar behåller sin sparade behandlingstid även om de bokas om.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {editHours.map(h=>(
              <fieldset key={h.day} className="space-y-3 rounded-xl border border-[#e8d9dc] p-4">
                <legend className="px-2 font-semibold text-[#51313e]">{h.day===5?"Fredag":h.day===6?"Lördag":"Söndag"}</legend>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input name={`day_${h.day}_closed`} type="checkbox" defaultChecked={h.closed}
                    className="h-4 w-4 accent-[#845363]"/> Stängt
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-[#634853]">
                  Tidigaste start
                  <input type="time" name={`day_${h.day}_first`} step={1800} defaultValue={h.first} required
                    className="min-h-11 rounded-lg border border-[#d8c4cb] px-3 text-sm"/>
                </label>
                <label className="grid gap-1.5 text-xs font-semibold text-[#634853]">
                  Senaste start
                  <input type="time" name={`day_${h.day}_last`} step={1800} defaultValue={h.last} required
                    className="min-h-11 rounded-lg border border-[#d8c4cb] px-3 text-sm"/>
                </label>
              </fieldset>
            ))}
          </div>
          <p className="text-xs text-[#705f65]">Starttider visas varje halvtimme. Välj 0 minuters paus om du själv vill blockera extra tid före eller efter via &quot;Hantera dagens tider&quot;. Redan bokad behandlingstid blockeras alltid.</p>
          <button type="submit" className="min-h-11 rounded-lg bg-[#845363] px-5 text-sm font-bold text-white hover:bg-[#6d3e4e]">
            Spara bokningstider
          </button>
        </form>
      </section>

      <section id="bokningar" className="scroll-mt-6 rounded-2xl border border-[#e8d9dc] bg-white p-4 sm:p-8">
        <h2 className="font-serif text-2xl text-[#352a2c]">Bokningar och lediga tider</h2>
        <p className="mt-2 text-sm leading-6 text-[#705f65]">Maria kan själv granska bokningsförfrågningar, bekräfta, avboka eller flytta tider från bokningsprofilen. Blockera eller frigör ledig tid före eller efter en bokning separat. Ingen handpenning registreras eller begärs automatiskt.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard/bokningar" className="inline-flex min-h-11 items-center rounded-lg bg-[#845363] px-5 text-sm font-bold text-white">Öppna bokningar</Link>
          <Link href="/dashboard/maria/kalender" className="inline-flex min-h-11 items-center rounded-lg border border-[#bfa1a9] px-5 text-sm font-bold text-[#754b5a]">Hantera dagens tider</Link>
          <Link href="/dashboard/bokningar/blockera" className="inline-flex min-h-11 items-center rounded-lg border border-[#e8d9dc] px-4 text-xs text-[#705f65]">Avancerad tidsblockering</Link>
        </div>
      </section>

      <section className="flex items-start gap-3 rounded-xl border border-[#dec6cd] bg-[#fbf0ef] p-5 text-sm text-[#684956]">
        <ShieldCheck className="mt-1 shrink-0" size={20} />
        <div>
          <strong>Endast intern förhandsvisning.</strong>
          <p className="mt-1 leading-6">
            {bookingReadiness.enabled
              ? "Endast bokningar till den godkända QA-testadressen tillåts i denna Preview."
              : "Designen skickar inte bokningar eller kunduppgifter."} Priser för kommande år, tjänsternas längd och Marias framtida ägaråtkomst behöver bekräftas innan lansering.
            Domän och riktiga kundnotiser är inte aktiverade.
          </p>
        </div>
      </section>
    </main>
  );
}
