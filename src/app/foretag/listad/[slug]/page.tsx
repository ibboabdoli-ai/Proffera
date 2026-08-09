import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, MapPin, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { getPublicDirectoryBusiness } from "@/lib/company-directory-engine";
import { getClaimedDirectoryWorkspaceSlug } from "@/lib/company-directory-routing";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const categoryLabels: Record<string, string> = {
  stadning: "Städning",
  flytt: "Flytt",
  elektriker: "Elektriker",
  vvs: "VVS",
  maleri: "Måleri",
  snickeri: "Snickeri",
  tradgard: "Trädgård",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicDirectoryBusiness(slug);
  if (!business) return {};
  const category = categoryLabels[business.categorySlug] ?? business.primarySniLabel ?? "Tjänster";
  const description = business.activityDescription || `${business.companyName} i ${business.city} – ${category}.`;
  return {
    title: `${business.companyName} | Proffera`,
    description,
    robots: { index: true, follow: true },
    openGraph: business.media?.url ? {
      title: business.companyName,
      description,
      images: [{ url: business.media.url, alt: business.media.isActualBusinessMedia ? business.companyName : `${category} – illustrationsbild` }],
    } : undefined,
  };
}

export default async function ListedBusinessPage({ params }: Props) {
  const { slug } = await params;
  const business = await getPublicDirectoryBusiness(slug);
  if (!business) {
    const workspaceSlug = await getClaimedDirectoryWorkspaceSlug(slug);
    if (workspaceSlug) redirect(`/foretag/${encodeURIComponent(workspaceSlug)}`);
    notFound();
  }

  const category = categoryLabels[business.categorySlug] ?? business.primarySniLabel ?? "Tjänsteföretag";
  const location = [business.postalCode, business.city].filter(Boolean).join(" ");
  const updated = business.sourceUpdatedAt
    ? new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeZone: "Europe/Stockholm" }).format(new Date(business.sourceUpdatedAt))
    : "kontrollerad vid senaste synk";

  return (
    <main className="min-h-screen bg-[#f6f7f5] px-4 py-8 text-[#17201a] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-lg font-black text-[#173e2b]">Proffera</Link>

        <article className="mt-7 overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-black/10">
          {business.media ? (
            <div className="relative h-64 sm:h-80">
              <Image
                src={business.media.url}
                alt={business.media.isActualBusinessMedia ? business.companyName : `${category} – illustrationsbild`}
                fill
                unoptimized
                sizes="(max-width: 1024px) 100vw, 960px"
                className="object-cover"
              />
              {!business.media.isActualBusinessMedia ? (
                <span className="absolute bottom-4 left-4 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white">
                  Illustrationsbild
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="p-6 sm:p-9">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#e8f2ec] px-3 py-1 text-xs font-black text-[#173e2b]">{category}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f2] px-3 py-1 text-xs font-bold text-[#536057]">
                    <ShieldCheck className="h-3.5 w-3.5" /> Officiella företagsdata
                  </span>
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{business.companyName}</h1>
                {location ? (
                  <p className="mt-3 flex items-center gap-2 text-[#5e685f]"><MapPin className="h-4 w-4" /> {location}</p>
                ) : null}
              </div>

              <Link
                href={`/foretag/claim/${encodeURIComponent(business.slug)}`}
                className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[#173e2b] px-5 font-black text-white"
              >
                Äger du företaget? <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              <section className="rounded-2xl bg-[#f7f8f6] p-5">
                <Building2 className="h-5 w-5 text-[#173e2b]" />
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#667168]">Bransch</p>
                <p className="mt-1 font-bold">{business.primarySniLabel || category}</p>
              </section>
              <section className="rounded-2xl bg-[#f7f8f6] p-5">
                <BadgeCheck className="h-5 w-5 text-[#173e2b]" />
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#667168]">Status</p>
                <p className="mt-1 font-bold">{business.organizationStatus || "Aktiv organisation"}</p>
              </section>
              <section className="rounded-2xl bg-[#f7f8f6] p-5">
                <ShieldCheck className="h-5 w-5 text-[#173e2b]" />
                <p className="mt-3 text-xs font-black uppercase tracking-wide text-[#667168]">Datakvalitet</p>
                <p className="mt-1 font-bold">Automatiskt datakontrollerad</p>
              </section>
            </div>

            {business.activityDescription ? (
              <section className="mt-9">
                <h2 className="text-xl font-black">Om verksamheten</h2>
                <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-[#566058]">{business.activityDescription}</p>
              </section>
            ) : null}

            <section className="mt-9 border-t border-black/10 pt-6">
              <h2 className="text-base font-black">Företagsuppgifter</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div><dt className="text-[#6b746d]">Företagsform</dt><dd className="mt-1 font-bold">{business.legalForm || "–"}</dd></div>
                <div><dt className="text-[#6b746d]">Ort</dt><dd className="mt-1 font-bold">{business.city || "–"}</dd></div>
                <div><dt className="text-[#6b746d]">Kommun</dt><dd className="mt-1 font-bold">{business.municipality || "–"}</dd></div>
                <div><dt className="text-[#6b746d]">Adress</dt><dd className="mt-1 font-bold">{business.addressLine1 || "–"}</dd></div>
              </dl>
            </section>

            <aside className="mt-8 rounded-2xl border border-[#d7e4da] bg-[#f2f8f4] p-5 text-sm leading-6 text-[#425047]">
              <p className="font-black text-[#173e2b]">Var kommer informationen från?</p>
              <p className="mt-1">
                Grunduppgifterna kommer från officiell företagsdata och kvalitetssäkras automatiskt av Proffera. Senast uppdaterad: {updated}.
              </p>
              <p className="mt-2">Detta betyder inte att företagets ägare har verifierat eller gjort anspråk på profilen.</p>
              {!business.media?.isActualBusinessMedia ? (
                <p className="mt-2">Bilden är en Proffera-illustration för branschen och föreställer inte företagets verkliga lokal eller arbete.</p>
              ) : null}
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}
