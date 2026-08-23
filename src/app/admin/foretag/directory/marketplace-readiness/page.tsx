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
  if (row.marketplaceReady) return row.claimed ? "Marketplace Ready · Workspace" : "Marketplace Ready";
  if (row.needsGeocoding) return "Needs Geocoding";
  if (row.needsContact) return "Needs Contact";
  if (row.needsLocationSource) return "Needs Address";
  return "Review";
}

function addressText(row: Awaited<ReturnType<typeof getCompanyDirectoryMarketplaceReadinessReport>>["rows"][number]) {
  if (!row.address) return "—";
  return `${row.address.addressLine1}, ${row.address.postalCode} ${row.address.city}`;
}

function reasonText(row: Awaited<ReturnType<typeof getCompanyDirectoryMarketplaceReadinessReport>>["rows"][number]) {
  const reason = row.reasons.find((value) => !["marketplace_ready", "auto_outreach_ready"].includes(value));
  if (!reason) return "—";
  if (reason === "ambiguous_workplace") return "Flera arbetsställen – ingen gissning";
  if (reason === "missing_workplace_address") return "Arbetsplatsadress saknas";
  if (reason === "needs_geocoding") return "Väntar på verifierad position";
  if (reason === "needs_contact") return "Kontakt saknas";
  if (reason === "claimed_workspace_route") return "Hanteras via Workspace";
  if (reason === "scb_conflict") return "SCB-konflikt";
  return reason;
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
            Published är separat från Marketplace Ready. Marketplace Ready kräver ett entydigt arbetsställe, verifierad Lantmäteriet-position och en användbar kontaktväg. Auto Outreach Ready kräver dessutom ett säkert företagsmejl.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-bold">
            <Link href="/admin/foretag/directory" className="text-[#d6eadd] underline underline-offset-4">Directory</Link>
            <Link href="/admin/foretag/directory/search-preview" className="text-[#d6eadd] underline underline-offset-4">Plats & sökning</Link>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-5 text-sm leading-6 text-[#6d5418]">
          <p className="font-black">Ingen bred Production-geocoding aktiveras här.</p>
          <p className="mt-1">
            SCB används som adressunderlag. En position räknas som verifierad först när den har godkänd Lantmäteriet-provenance. Tabellen är en begränsad läskö och gör inga Production-ändringar.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Published active" value={report.publishedActive} note="Exakt antal aktiva publicerade profiler." />
          <Metric label="Loaded queue" value={report.loaded} note="Högst 150 profiler läses för denna interna arbetskö." />
          <Metric label="Marketplace Ready" value={report.marketplaceReady} note="Ready bland profilerna som är laddade i kön." />
          <Metric label="Auto Outreach Ready" value={report.autoOutreachReady} note="Guest-profiler med verifierad plats och säkert företagsmejl." />
          <Metric label="Needs geocoding" value={report.needsGeocoding} note="Har ett entydigt arbetsställe men saknar verifierad Lantmäteriet-position." />
          <Metric label="Needs contact" value={report.needsContact} note="Saknar användbar kontaktväg." />
        </div>

        <section className="mt-7 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
          <div className="border-b border-black/5 p-5 sm:p-6">
            <h2 className="text-xl font-black text-[#17201a]">Prioriterad arbetskö</h2>
            <p className="mt-2 text-sm leading-6 text-[#657068]">
              Kön är medvetet begränsad till 150 profiler. Företag som kan bli Auto Outreach Ready efter geocoding visas först, sedan övriga luckor.
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
                  <th className="px-4 py-3 font-black">Orsak</th>
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
                      {row.hasVerifiedCoordinates ? "Verifierad" : "Saknas"}
                    </td>
                    <td className="max-w-xs px-4 py-4 text-xs text-[#657068]">{reasonText(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.rows.length === 0 ? (
            <p className="p-6 text-sm text-[#657068]">Ingen profil finns i readiness-kön.</p>
          ) : null}
        </section>

        <p className="mt-4 text-xs text-[#7a847d]">Rapport genererad {report.generatedAt}</p>
      </section>
    </main>
  );
}
