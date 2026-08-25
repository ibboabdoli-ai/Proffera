import "server-only";

import { getSql } from "@/lib/db/server";
import type { PublicBusinessService, PublicBusinessWorkspace } from "@/lib/public-business-hub";
import { resolvePublicCustomDomain } from "@/lib/public-site-domain-routing";
import { hostnameFromHostHeader } from "@/lib/public-site-domains";
import { siteConfig } from "@/lib/site";
import { hasWorkspaceFeatureAccessForWorkspace } from "@/lib/workspace-feature-entitlement-db";

export type PublicBusinessUrlContext = {
  customDomain: boolean;
  origin: string;
  companyCanonical: string;
  companyHref: string;
  serviceCanonical: (serviceSlug: string) => string;
  serviceHref: (serviceSlug: string) => string;
};

function platformCompanyPath(workspaceSlug: string) {
  return `/foretag/${encodeURIComponent(workspaceSlug)}`;
}

function platformServicePath(workspaceSlug: string, serviceSlug: string) {
  return `${platformCompanyPath(workspaceSlug)}/tjanster/${encodeURIComponent(serviceSlug)}`;
}

export function isIndexablePublicBusinessWorkspace(
  workspace: Pick<PublicBusinessWorkspace, "status" | "companyName" | "slug">,
) {
  if (workspace.status !== "active") return false;
  const companyName = workspace.companyName.trim().toLocaleLowerCase("sv-SE");
  return !companyName.startsWith("proffera test");
}

export async function resolvePublicBusinessUrlContext(
  host: string | null | undefined,
  workspaceSlug: string,
): Promise<PublicBusinessUrlContext> {
  const normalizedWorkspaceSlug = workspaceSlug.trim().toLowerCase();
  const hostname = hostnameFromHostHeader(host);
  const target = hostname ? await resolvePublicCustomDomain(hostname) : null;

  if (
    target &&
    target.publicHomeMode === "website" &&
    target.workspaceSlug === normalizedWorkspaceSlug
  ) {
    const origin = `https://${hostname}`;
    return {
      customDomain: true,
      origin,
      companyCanonical: `${origin}/`,
      companyHref: "/",
      serviceCanonical: (serviceSlug) => `${origin}/tjanster/${encodeURIComponent(serviceSlug)}`,
      serviceHref: (serviceSlug) => `/tjanster/${encodeURIComponent(serviceSlug)}`,
    };
  }

  const companyPath = platformCompanyPath(normalizedWorkspaceSlug);
  return {
    customDomain: false,
    origin: siteConfig.url,
    companyCanonical: `${siteConfig.url}${companyPath}`,
    companyHref: companyPath,
    serviceCanonical: (serviceSlug) => `${siteConfig.url}${platformServicePath(normalizedWorkspaceSlug, serviceSlug)}`,
    serviceHref: (serviceSlug) => platformServicePath(normalizedWorkspaceSlug, serviceSlug),
  };
}

export function serializePublicBusinessJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildPublicBusinessJsonLd(
  business: PublicBusinessWorkspace,
  services: PublicBusinessService[],
  urls: PublicBusinessUrlContext,
) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${urls.companyCanonical}#business`,
    name: business.companyName,
    url: urls.companyCanonical,
    ...(business.primaryCity ? { areaServed: business.primaryCity } : {}),
    ...(business.contactEmail ? { email: business.contactEmail } : {}),
    ...(business.contactPhone ? { telephone: business.contactPhone } : {}),
    ...(business.experience.logoUrl ? { logo: business.experience.logoUrl } : {}),
    ...(business.experience.heroImageUrl ? { image: business.experience.heroImageUrl } : {}),
    ...(services.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Services",
            itemListElement: services.map((service) => ({
              "@type": "Offer",
              itemOffered: {
                "@type": "Service",
                name: service.name,
                url: urls.serviceCanonical(service.publicSlug),
              },
            })),
          },
        }
      : {}),
  };
}

export function buildPublicServiceJsonLd(
  business: PublicBusinessWorkspace,
  service: PublicBusinessService,
  urls: PublicBusinessUrlContext,
) {
  const description = service.seoDescription || service.shortDescription || service.description;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${urls.serviceCanonical(service.publicSlug)}#service`,
    name: service.name,
    url: urls.serviceCanonical(service.publicSlug),
    ...(description ? { description } : {}),
    ...(service.coverImageUrl ? { image: service.coverImageUrl } : {}),
    ...(service.serviceArea || business.primaryCity
      ? { areaServed: service.serviceArea || business.primaryCity }
      : {}),
    provider: {
      "@type": "LocalBusiness",
      "@id": `${urls.companyCanonical}#business`,
      name: business.companyName,
      url: urls.companyCanonical,
    },
  };
}

export type PublicBusinessSitemapEntry = {
  workspaceId: string;
  workspaceSlug: string;
  serviceSlug: string | null;
};

export async function listPublicBusinessSitemapEntries(): Promise<PublicBusinessSitemapEntry[]> {
  const sql = getSql();
  if (!sql) return [];

  try {
    const rows = await sql`
      select
        workspace.id::text as workspace_id,
        workspace.slug as workspace_slug,
        workspace.status,
        coalesce(workspace.company_name, workspace.name, '') as company_name,
        service.public_slug as service_slug
      from workspaces workspace
      left join workspace_services service
        on service.workspace_id = workspace.id::text
       and service.is_active = true
       and service.public_status = 'published'
       and service.public_slug is not null
      where workspace.status = 'active'
        and workspace.slug is not null
      order by workspace.slug asc, service.sort_order asc, service.name asc
    `;

    const eligibleRows = rows.filter((row) => isIndexablePublicBusinessWorkspace({
      status: row.status === "active" ? "active" : "trial",
      companyName: String(row.company_name ?? ""),
      slug: String(row.workspace_slug ?? ""),
    }));
    const workspaceIds = [...new Set(eligibleRows.map((row) => String(row.workspace_id ?? "")).filter(Boolean))];
    const accessPairs = await Promise.all(
      workspaceIds.map(async (workspaceId) => [
        workspaceId,
        await hasWorkspaceFeatureAccessForWorkspace(workspaceId, "website_builder"),
      ] as const),
    );
    const enabledWorkspaceIds = new Set(accessPairs.filter(([, enabled]) => enabled).map(([workspaceId]) => workspaceId));

    return eligibleRows
      .map((row) => ({
        workspaceId: String(row.workspace_id ?? ""),
        workspaceSlug: String(row.workspace_slug ?? "").trim(),
        serviceSlug: row.service_slug ? String(row.service_slug).trim() : null,
      }))
      .filter((row) => enabledWorkspaceIds.has(row.workspaceId) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.workspaceSlug));
  } catch (error) {
    console.error("Failed to list Public Business Hub sitemap entries", error);
    return [];
  }
}
