import {
  classifyCompanyDirectoryGeoCoverage,
  type CompanyDirectoryGeoCoverageState,
} from "@/lib/company-directory-service-area-policy";
import { serviceCategoryForQuoteCategory } from "@/lib/service-catalog";
import { resolveWorkspaceFeatureAccess } from "@/lib/workspace-feature-access";
import { isWorkspacePlanFeatureIncluded } from "@/lib/workspace-feature-policy";

export type LeadMatchInput = {
  category: string;
  service_type: string;
  city: string;
  customerLatitude?: unknown;
  customerLongitude?: unknown;
};

export type WorkspaceLeadCandidate = {
  workspaceId: string;
  companyName: string;
  primaryCity: string;
  email: string;
  phone: string;
  workspaceStatus: string;
  claimedProfileId: string;
  claimedProfileCategorySlug: string;
  claimedProfileIsActive: boolean;
  claimedProfilePrivacyBlocked: boolean;
  claimStatus: string;
  claimVerifiedAt: string | null;
  claimResolvedAt: string | null;
  serviceId: string;
  serviceName: string;
  serviceCategory: string;
  serviceArea: string;
  serviceAreaRadiusKm?: number | null;
  providerLatitude?: unknown;
  providerLongitude?: unknown;
  providerPointVerified?: boolean;
  providerCity?: string;
  providerMunicipality?: string;
  serviceIsActive: boolean;
  servicePublicStatus: string;
  serviceConversionMode: string;
  featureMinimumPlan: unknown;
  workspaceFeatureEnabled: boolean;
  adminOverrideEnabled: boolean | null;
  planKey: unknown;
  planStatus: unknown;
  planPeriodEnd: unknown;
  trialStatus: unknown;
  trialEndsAt: unknown;
};

export type WorkspaceLeadSuggestion = {
  workspaceId: string;
  companyName: string;
  primaryCity: string;
  email: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  serviceArea: string;
  coverageState: CompanyDirectoryGeoCoverageState;
  distanceKm: number | null;
  score: number;
  reasons: string[];
};

function normalizeMatchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function meaningfulTokens(value: string) {
  return normalizeMatchText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function textsOverlap(left: string, right: string) {
  const normalizedLeft = normalizeMatchText(left);
  const normalizedRight = normalizeMatchText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;

  const leftTokens = meaningfulTokens(left);
  const rightTokens = meaningfulTokens(right);
  return leftTokens.some((leftToken) =>
    rightTokens.some((rightToken) => {
      const shortest = Math.min(leftToken.length, rightToken.length);
      const prefixLength = Math.min(7, shortest);
      return prefixLength >= 5 && leftToken.slice(0, prefixLength) === rightToken.slice(0, prefixLength);
    }),
  );
}

export function isValidLeadRecipientEmail(value: string) {
  const email = value.trim();
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isLeadCapableServiceConversionMode(value: string) {
  return value === "quote" || value === "book_or_quote" || value === "contact";
}

function isGenericServiceType(value: string) {
  const normalized = normalizeMatchText(value);
  return normalized.startsWith("annat ") || normalized.startsWith("annan ") || normalized.startsWith("ovrig ");
}

function hasLeadManagementAccess(candidate: WorkspaceLeadCandidate, now: Date) {
  const includedInPlan = isWorkspacePlanFeatureIncluded({
    planKey: candidate.planKey,
    planStatus: candidate.planStatus,
    planPeriodEnd: candidate.planPeriodEnd,
    minimumPlan: candidate.featureMinimumPlan,
    now,
  });
  const trialEndsAt = candidate.trialEndsAt ? new Date(String(candidate.trialEndsAt)) : null;
  const trialActive =
    String(candidate.trialStatus ?? "") === "active" &&
    Boolean(trialEndsAt) &&
    !Number.isNaN(trialEndsAt!.getTime()) &&
    trialEndsAt!.getTime() > now.getTime();

  return resolveWorkspaceFeatureAccess({
    includedInPlan,
    trialActive,
    workspaceEnabled: candidate.workspaceFeatureEnabled,
    adminOverrideEnabled: candidate.adminOverrideEnabled,
  }).hasAccess;
}

function isStructurallyEligible(candidate: WorkspaceLeadCandidate, now: Date) {
  if (candidate.workspaceStatus !== "active" && candidate.workspaceStatus !== "trial") return false;
  if (!candidate.claimedProfileId || !candidate.claimedProfileIsActive || candidate.claimedProfilePrivacyBlocked) return false;
  if (candidate.claimStatus !== "claimed" || !candidate.claimVerifiedAt || !candidate.claimResolvedAt) return false;
  if (!isValidLeadRecipientEmail(candidate.email)) return false;
  if (!candidate.serviceIsActive || candidate.servicePublicStatus !== "published") return false;
  if (!isLeadCapableServiceConversionMode(candidate.serviceConversionMode)) return false;
  return hasLeadManagementAccess(candidate, now);
}

function serviceCompatibility(lead: LeadMatchInput, candidate: WorkspaceLeadCandidate) {
  const expectedCategorySlug = serviceCategoryForQuoteCategory(lead.category);
  if (!expectedCategorySlug || candidate.claimedProfileCategorySlug !== expectedCategorySlug) {
    return { compatible: false, specific: false };
  }

  const specific = textsOverlap(candidate.serviceName, lead.service_type);
  if (specific || isGenericServiceType(lead.service_type)) return { compatible: true, specific };

  const category = textsOverlap(candidate.serviceName, lead.category) || textsOverlap(candidate.serviceCategory, lead.category);
  if (lead.category === "Städning") return { compatible: false, specific: false };
  return { compatible: category, specific: false };
}

function localityMatches(lead: LeadMatchInput, candidate: WorkspaceLeadCandidate) {
  if (!normalizeMatchText(lead.city)) return false;
  return textsOverlap(candidate.providerCity ?? "", lead.city)
    || textsOverlap(candidate.providerMunicipality ?? "", lead.city);
}

function geoReason(state: CompanyDirectoryGeoCoverageState) {
  if (state === "confirmed_inside") return "bekräftat serviceområde";
  if (state === "inferred_nearby") return "närhet – serviceområde ej bekräftat";
  if (state === "locality_fallback") return "lokalitet – serviceområde ej bekräftat";
  return "";
}

export function buildWorkspaceLeadSuggestions(
  lead: LeadMatchInput,
  candidates: WorkspaceLeadCandidate[],
  now = new Date(),
): WorkspaceLeadSuggestion[] {
  const suggestions = new Map<string, WorkspaceLeadSuggestion>();

  for (const candidate of candidates) {
    if (!isStructurallyEligible(candidate, now)) continue;
    const compatibility = serviceCompatibility(lead, candidate);
    if (!compatibility.compatible) continue;

    const coverage = classifyCompanyDirectoryGeoCoverage({
      providerLatitude: candidate.providerLatitude,
      providerLongitude: candidate.providerLongitude,
      providerPointVerified: candidate.providerPointVerified,
      customerLatitude: lead.customerLatitude,
      customerLongitude: lead.customerLongitude,
      confirmedRadiusKm: candidate.serviceAreaRadiusKm,
      localityMatched: localityMatches(lead, candidate),
      fallbackMaxDistanceKm: 50,
    });
    if (coverage.state === "confirmed_outside" || coverage.state === "unknown") continue;

    let score = 60;
    const reasons = ["verifierat företag", "kategori"];
    if (compatibility.specific) {
      score += 25;
      reasons.push("tjänst");
    } else {
      score += 15;
      reasons.push("tjänstekategori");
    }
    if (coverage.state === "confirmed_inside") score += 15;
    else score += 10;
    reasons.push(geoReason(coverage.state));

    const suggestion: WorkspaceLeadSuggestion = {
      workspaceId: candidate.workspaceId,
      companyName: candidate.companyName,
      primaryCity: candidate.primaryCity,
      email: candidate.email.trim().toLowerCase(),
      phone: candidate.phone,
      serviceId: candidate.serviceId,
      serviceName: candidate.serviceName,
      serviceArea: candidate.serviceArea,
      coverageState: coverage.state,
      distanceKm: coverage.distanceKm,
      score,
      reasons,
    };
    const existing = suggestions.get(candidate.workspaceId);
    if (!existing || suggestion.score > existing.score) suggestions.set(candidate.workspaceId, suggestion);
  }

  return [...suggestions.values()]
    .sort((left, right) => right.score - left.score || left.companyName.localeCompare(right.companyName, "sv"))
    .slice(0, 10);
}
