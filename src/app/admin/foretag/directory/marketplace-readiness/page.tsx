import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { getCompanyDirectoryMarketplaceReadinessReport } from "@/lib/company-directory-marketplace-readiness";

export const dynamic = "force-dynamic";

function Metric({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-[#657068]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#17201a]">{value}</p>
      <p className="mt-2 text-xs leading-5 text-[#657068]">{note}</p>
    </div>
  );
}

function statusLabel(row: Awaited<ReturnType<typeof getCompanyDirectoryMarketplaceReadinessReport>>["rows"][number]) {
  if (row.autoOutreachReady) return "Auto Outreach Ready";
  if (row.marketplaceReady) return "Marketplace Ready";
  if (row.potentialAutoOutreachAfterGeocoding) return "Geocode → Auto Ready";
  if (row.needsGeocoding) return "Needs Geocoding";
  if (row.needsContact) return "Needs Contact";
  if (row.needsLocationSource) return "Needs Location";
  return "Review";
}

function addressText(row: Awaited<ReturnType<typeof getCompanyDirectoryMarketplaceReadinessReport>>["rows"][number]) {
  if (!row.address) return "—";
  return `${row.address.addressLine1}, ${row.address.postalCode} ${row.address.city}`;
}

export default async function DirectoryMarketplaceReadinessPage() {
  await requireSuperAdmin();
  const report = await getCompanyDirectoryMarketplaceReadinessReport();

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[1.75rem] bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10 sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Företagsdirectory · Intern kontroll</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Marketplace readiness</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-white/75">
            Separera publicerad företagsdata från faktisk Marketplace-beredskap. En gästleverantör är redo först när tjänsten är säker, en användbar arbetsplats finns, en verifierad position finns och minst en kontaktväg kan användas.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold">
            <Link href="/admin/foretag/directory" className="text-[#d6eadd] underline underline-offset-4">Directory</Link>
            <Link href="/admin/foretag/directory/search-preview" className="text-[#d6eadd] underline underline-offset-4">Plats & sökning</Link>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-5 text-sm leading-6 text-[#6d5418]">
          <p className="font-black">Lantmäteriet PROD behövs inte för att bygga kön.</p>
          <p className="mt-1">
            SCB:s arbetsställe används som adressunderlag nu. Själva steget från adress till verifierad latitude/longitude väntar tills Lantmäteriet PROD-access finns. Ingen osäker koordinat skapas här.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Published active" value={report.publishedActive} note="Alla aktiva publicerade profiler i rapporten." />
          <Metric label="Guest eligible" value={report.guestEligible} note="Säkra juridiska personer, oclaimade, med publik tjänst och utan SCB-conflict." />
          <Metric label="Arbetsplatsadress" value={report.withUsableWorkplaceAddress} note="Användbar SCB visiting/postal address, utan Box/Kivra." />
          <Metric label="Verifierad position" value={report.geocoded} note="Publik latitude/longitude finns redan." />
          <Metric label="Needs geocoding" value={report.needsGeocoding} note="Har användbar adress men saknar verifierad position." />
          <Metric label="Needs contact" value={report.needsContact} note="Saknar både säkert företagsmejl och användbart telefonnummer." />
          <Metric label="Geocode → Auto Ready" value={report.potentialAutoOutreachAfterGeocoding} note="Har redan SCB-adress + säkert företagsmejl; väntar bara på geocoding." />
          <Metric label="Auto Outreach Ready" value={report.autoOutreachReady} note="Har verifierad position + säkert företagsmejl för nuvarande automatiska e-postflöde." />
        </div>

        <section className="mt-7 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          <div className="border-b border-black/5 p-5 sm:p-6">
            <h2 className="text-xl font-black text-[#17201a]">Prioriterad arbetskö</h2>
            <p className="mt-2 text-sm leading-6 text-[#657068]">
              Först visas företag som kan bli Auto Outreach Ready direkt efter geocoding, därefter övriga adress- och kontaktluckor. Tabellen visar högst 150 profiler och gör inga ändringar i Production.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f7f7f4] text-xs uppercase tracking-[0.08em] text-[#657068]">
                <tr>
                  <th className="px-4 py-3 font-black">Företag</th>
                  <th className="px-4 py-3 font-black">Status</th>
                  <th className="px-4 py-3 font-black">SCB arbetsplats</th>
                  <th className="px-4 py-3 font-black">Kontakt</th>
                  <th className="px-4 py-3 font-black">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {report.rows.map((row) => (
                  <tr key={row.profileId} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-black text-[#17201a]">{row.companyName}</p>
                      <p className="mt-1 text-xs text-[#657068]">{row.organizationNumber}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-[#eef3ef] px-2.5 py-1 text-xs font-black text-[#31513d]">
                        {statusLabel(row)}
                      </span>
                    </td>
                    <td className="max-w-md px-4 py-4 text-[#465149]">
                      <p>{addressText(row)}</p>
                      {row.address ? <p className="mt-1 text-xs text-[#7a847d]">{row.address.source}</p> : null}
                    </td>
                    <td className="px-4 py-4 text-[#465149]">
                      <p>{row.businessEmail || "—"}</p>
                      {row.phone ? <p className="mt-1 text-xs text-[#7a847d]">{row.phone}</p> : null}
                    </td>
                    <td className="px-4 py-4 font-semibold text-[#465149]">
                      {row.hasCoordinates ? "Verifierad" : "Saknas"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.rows.length === 0 ? (
            <p className="p-6 text-sm text-[#657068]">Ingen gästprofil finns i readiness-kön.</p>
          ) : null}
        </section>

        <p className="mt-4 text-xs text-[#7a847d]">Rapport genererad {report.generatedAt}</p>
      </section>
    </main>
  );
}
