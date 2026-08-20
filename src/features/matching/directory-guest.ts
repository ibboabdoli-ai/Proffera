import "server-only";

import { getSql } from "@/lib/db/server";
import { serviceCategoryForQuoteCategory } from "@/lib/service-catalog";

type GuestLead = {
  id: string;
  reference_id: string;
  category: string;
  service_type: string;
  city: string;
  postal_code: string;
  description: string;
  status: string;
  created_at: string;
};

export type DirectoryGuestCandidate = {
  profileId: string;
  slug: string;
  companyName: string;
  city: string;
  municipality: string;
  serviceSlug: string;
  serviceName: string;
  serviceCategory: string;
  qualityScore: number;
  score: number;
  reasons: string[];
  serviceAreaConfirmed: false;
};

export type DirectoryGuestLeadMatch = {
  lead: GuestLead;
  candidates: DirectoryGuestCandidate[];
};

type PreparedText = {
  normalized: string;
  tokens: string[];
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function prepare(value: string): PreparedText {
  const normalized = normalize(value);
  return {
    normalized,
    tokens: normalized.split(/\s+/).filter((token) => token.length >= 4),
  };
}

function overlapsPrepared(left: PreparedText, right: PreparedText) {
  if (!left.normalized || !right.normalized) return false;
  if (left.normalized === right.normalized) return true;

  const shortestLength = Math.min(left.normalized.length, right.normalized.length);
  if (
    shortestLength >= 5
    && (left.normalized.includes(right.normalized) || right.normalized.includes(left.normalized))
  ) {
    return true;
  }

  return left.tokens.some((leftToken) => right.tokens.some((rightToken) => {
    const shortest = Math.min(leftToken.length, rightToken.length);
    const prefixLength = Math.min(7, shortest);
    return prefixLength >= 5 && leftToken.slice(0, prefixLength) === rightToken.slice(0, prefixLength);
  }));
}

function genericService(prepared: PreparedText) {
  return prepared.normalized.startsWith("annat ")
    || prepared.normalized.startsWith("annan ")
    || prepared.normalized.startsWith("ovrig ");
}

export function rankDirectoryGuestCandidates(
  lead: Pick<GuestLead, "category" | "service_type" | "city">,
  rows: Array<{
    profileId: string;
    slug: string;
    companyName: string;
    city: string;
    municipality: string;
    categorySlug: string;
    serviceSlug: string;
    serviceName: string;
    serviceCategory: string;
    qualityScore: number;
  }>,
) {
  const expectedCategory = serviceCategoryForQuoteCategory(lead.category);
  if (!expectedCategory) return [] as DirectoryGuestCandidate[];

  const preparedLeadCity = prepare(lead.city);
  const preparedLeadService = prepare(lead.service_type);
  const preparedLeadCategory = prepare(lead.category);
  const leadHasCity = Boolean(preparedLeadCity.normalized);
  const leadHasGenericService = genericService(preparedLeadService);

  const best = new Map<string, DirectoryGuestCandidate>();
  for (const row of rows) {
    if (row.categorySlug !== expectedCategory) continue;

    const preparedRowCity = prepare(row.city);
    const preparedRowMunicipality = prepare(row.municipality);
    const local = !leadHasCity
      || overlapsPrepared(preparedRowCity, preparedLeadCity)
      || overlapsPrepared(preparedRowMunicipality, preparedLeadCity);
    if (!local) continue;

    const preparedServiceName = prepare(row.serviceName);
    const preparedServiceCategory = prepare(row.serviceCategory);
    const specific = overlapsPrepared(preparedServiceName, preparedLeadService);
    const categoryCompatible = overlapsPrepared(preparedServiceName, preparedLeadCategory)
      || overlapsPrepared(preparedServiceCategory, preparedLeadCategory);
    if (!specific && !leadHasGenericService && !categoryCompatible) continue;
    if (lead.category === "Städning" && !specific && !leadHasGenericService) continue;

    let score = 55;
    const reasons = ["publicerad företagsprofil", "rätt kategori"];
    if (specific) {
      score += 25;
      reasons.push("tjänstmatch");
    } else {
      score += 15;
      reasons.push("kategorimatch");
    }
    if (leadHasCity) {
      score += 10;
      reasons.push("lokal kandidat – serviceområde ej bekräftat");
    }
    score += Math.min(10, Math.max(0, Math.round(row.qualityScore / 10)));

    const candidate: DirectoryGuestCandidate = {
      profileId: row.profileId,
      slug: row.slug,
      companyName: row.companyName,
      city: row.city,
      municipality: row.municipality,
      serviceSlug: row.serviceSlug,
      serviceName: row.serviceName,
      serviceCategory: row.serviceCategory,
      qualityScore: row.qualityScore,
      score: Math.min(100, score),
      reasons,
      serviceAreaConfirmed: false,
    };
    const existing = best.get(row.profileId);
    if (!existing || candidate.score > existing.score) best.set(row.profileId, candidate);
  }

  return [...best.values()]
    .sort((left, right) => right.score - left.score || right.qualityScore - left.qualityScore || left.companyName.localeCompare(right.companyName, "sv"))
    .slice(0, 5);
}

export async function getDirectoryGuestLeadMatches() {
  const sql = getSql();
  if (!sql) return { ok: false as const, message: "Databasen är inte konfigurerad.", matches: [] as DirectoryGuestLeadMatch[] };

  try {
    const leads = await sql`
      select id::text, reference_id, category, service_type, city, postal_code, description, status, created_at::text
      from quote_requests
      where status in ('submitted', 'pending_review', 'approved', 'matched', 'answered')
      order by created_at desc
      limit 50
    `;

    const typedLeads = leads as GuestLead[];
    const requiredCategories = new Set<string>();
    for (const lead of typedLeads) {
      const category = serviceCategoryForQuoteCategory(lead.category);
      if (category) requiredCategories.add(category);
    }
    if (requiredCategories.size === 0) {
      return {
        ok: true as const,
        matches: typedLeads.map((lead) => ({ lead, candidates: [] })),
      };
    }
    const requiredCategoryCsv = [...requiredCategories].join(",");

    const candidates = await sql`
      select
        profile.id::text as profile_id,
        profile.public_slug,
        profile.display_name,
        profile.city,
        profile.municipality,
        profile.category_slug,
        profile.quality_score,
        relation.service_slug,
        service.label as service_name,
        category.label as service_category
      from company_directory_profiles profile
      join company_directory_profile_services relation
        on relation.profile_id = profile.id
       and relation.is_active = true
       and relation.public_visible = true
      join company_directory_services service
        on service.slug = relation.service_slug
       and service.is_active = true
      join company_directory_service_categories category
        on category.slug = service.category_slug
       and category.is_active = true
      where profile.publication_status = 'published'
        and profile.category_slug = any(string_to_array(${requiredCategoryCsv}, ','))
        and profile.claimed_workspace_id is null
        and profile.organization_kind = 'juridical_person'
        and profile.is_active = true
        and profile.privacy_blocked = false
      order by profile.quality_score desc, profile.display_name asc
      limit 5000
    `;

    const rowsByCategory = new Map<string, Array<{
      profileId: string;
      slug: string;
      companyName: string;
      city: string;
      municipality: string;
      categorySlug: string;
      serviceSlug: string;
      serviceName: string;
      serviceCategory: string;
      qualityScore: number;
    }>>();

    for (const row of candidates as Record<string, unknown>[]) {
      const categorySlug = text(row.category_slug);
      if (!requiredCategories.has(categorySlug)) continue;
      const normalizedRow = {
        profileId: text(row.profile_id),
        slug: text(row.public_slug),
        companyName: text(row.display_name),
        city: text(row.city),
        municipality: text(row.municipality),
        categorySlug,
        serviceSlug: text(row.service_slug),
        serviceName: text(row.service_name),
        serviceCategory: text(row.service_category),
        qualityScore: Number(row.quality_score ?? 0),
      };
      const bucket = rowsByCategory.get(categorySlug) ?? [];
      bucket.push(normalizedRow);
      rowsByCategory.set(categorySlug, bucket);
    }

    const matches = typedLeads.map((lead) => {
      const category = serviceCategoryForQuoteCategory(lead.category);
      return {
        lead,
        candidates: category ? rankDirectoryGuestCandidates(lead, rowsByCategory.get(category) ?? []) : [],
      };
    });
    return { ok: true as const, matches };
  } catch (error) {
    console.error("Failed to load guest marketplace candidates", error);
    return { ok: false as const, message: "Kunde inte läsa gästmatchningar.", matches: [] as DirectoryGuestLeadMatch[] };
  }
}
