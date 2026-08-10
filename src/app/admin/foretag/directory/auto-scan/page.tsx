import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

import DirectoryTestAutoScan from "@/app/admin/foretag/directory/preview/DirectoryTestAutoScan";
import { requireSuperAdmin } from "@/lib/admin-authorization";
import { getCompanyDirectorySourceReadiness } from "@/lib/company-directory-source-preview-admin";

export const dynamic = "force-dynamic";

export default async function DirectoryAutoScanPage() {
  await requireSuperAdmin();
  const readiness = getCompanyDirectorySourceReadiness();
  const enabled = process.env.VERCEL_ENV !== "production"
    && readiness.oauthConfigured
    && readiness.detailConfigured
    && readiness.officialTestCount > 0;

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <Link href="/admin/foretag/directory/preview" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#17452f] hover:bg-[#e7f1eb]">
          <ArrowLeft className="h-4 w-4" /> Källtest
        </Link>

        <div className="mt-6 rounded-[1.75rem] bg-[#102a1c] p-7 text-white sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Preview only · read-only</p>
          <h1 className="mt-2 text-3xl font-black">Automatiskt Bolagsverket TEST-scan</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Testar hela den dokumenterade TEST-listan i små batcher, utan databasändringar och utan att röra Production.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-[#d6e2d8] bg-[#f1f7f2] p-5 text-sm text-[#465349]">
          <p className="flex items-center gap-2 font-black text-[#17452f]"><ShieldCheck className="h-5 w-5" /> Säkerhetsregel</p>
          <p className="mt-2">Endast dokumenterade Bolagsverket TEST-identiteter används. Inga profiler, claims eller sync-runs skapas. Endpointen är blockerad i Production.</p>
        </div>

        <DirectoryTestAutoScan enabled={enabled} />

        {!enabled ? (
          <p className="mt-4 text-sm font-bold text-[#8b3024]">Auto Scan är bara tillgänglig i Preview när OAuth och detail-verifiering är konfigurerade.</p>
        ) : null}
      </section>
    </main>
  );
}
