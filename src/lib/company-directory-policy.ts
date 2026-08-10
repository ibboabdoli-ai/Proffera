export type DirectoryOrganizationKind = "juridical_person" | "sole_trader" | "unknown";

export type DirectoryCategoryMatch = {
  categorySlug: string;
  categoryLabel: string;
  serviceSlugs: string[];
};

export type NormalizedDirectoryCandidate = {
  countryCode: string;
  organizationNumber: string;
  organizationKind: DirectoryOrganizationKind;
  legalName: string;
  displayName: string;
  legalForm: string;
  organizationStatus: string;
  isActive: boolean;
  fTaxStatus: string;
  vatStatus: string;
  employerStatus: string;
  primarySniCode: string;
  primarySniLabel: string;
  activityDescription: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
  region: string;
  officialSource: string;
  sourceRecordId: string;
  sourceUpdatedAt: Date | null;
};

export type DirectoryQualityAssessment = {
  score: number;
  reasons: string[];
  privacyBlocked: boolean;
  autoPublicEligible: boolean;
  publicationStatus: "inactive" | "blocked" | "review" | "ready";
  category: DirectoryCategoryMatch | null;
};

const soleTraderLegalForms = [
  "enskild firma",
  "enskild näringsidkare",
  "enskild naringsidkare",
  "enskild näringsverksamhet",
  "enskild naringsverksamhet",
];

const juridicalLegalForms = [
  "aktiebolag",
  "ab",
  "handelsbolag",
  "hb",
  "kommanditbolag",
  "kb",
  "ekonomisk förening",
  "ekonomisk forening",
  "ideell förening",
  "ideell forening",
  "filial",
];

const pilotLocations = new Set(["stockholm", "södertälje"]);

function normalizeLocation(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("sv-SE");
}

function isPositiveRegistrationSignal(value: unknown) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("sv-SE");
  if (!normalized) return false;
  if (
    normalized.startsWith("ej ")
    || normalized.startsWith("inte ")
    || normalized.includes("ej registrerad")
    || normalized.includes("inte registrerad")
    || normalized.includes("avregistr")
    || ["false", "nej", "no", "0"].includes(normalized)
  ) return false;
  return normalized === "registrerad"
    || normalized === "godkänd"
    || normalized === "godkand"
    || normalized === "aktiv"
    || normalized === "active"
    || normalized === "ja"
    || normalized === "yes"
    || normalized.startsWith("registrerad ");
}

export function isDirectoryPilotLocation(candidate: Pick<NormalizedDirectoryCandidate, "city" | "municipality">) {
  return pilotLocations.has(normalizeLocation(candidate.city))
    || pilotLocations.has(normalizeLocation(candidate.municipality));
}

export function normalizeSniCode(value: unknown) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return "";
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return raw;
}

export function classifyOrganizationKind(legalForm: unknown): DirectoryOrganizationKind {
  const normalized = String(legalForm ?? "").trim().toLocaleLowerCase("sv-SE");
  if (!normalized) return "unknown";
  if (soleTraderLegalForms.some((item) => normalized === item || normalized.includes(item))) return "sole_trader";
  if (juridicalLegalForms.some((item) => normalized === item || normalized.includes(item))) return "juridical_person";
  return "unknown";
}

export function mapSniToDirectoryCategory(value: unknown): DirectoryCategoryMatch | null {
  const code = normalizeSniCode(value);

  if (code === "81.210") {
    return {
      categorySlug: "stadning",
      categoryLabel: "Städning",
      serviceSlugs: ["hemstadning", "kontorsstadning", "flyttstadning"],
    };
  }
  if (code === "81.221" || code.startsWith("81.22")) {
    return {
      categorySlug: "stadning",
      categoryLabel: "Städning",
      serviceSlugs: ["fonsterputsning"],
    };
  }
  if (code === "96.910") {
    return {
      categorySlug: "hemservice",
      categoryLabel: "Hemservice",
      serviceSlugs: [],
    };
  }
  if (code === "49.420") {
    return {
      categorySlug: "flytt",
      categoryLabel: "Flytt",
      serviceSlugs: ["flytthjalp"],
    };
  }
  if (code === "43.210") {
    return { categorySlug: "elektriker", categoryLabel: "Elektriker", serviceSlugs: ["elinstallation"] };
  }
  if (code === "43.221" || code.startsWith("43.22")) {
    return { categorySlug: "vvs", categoryLabel: "VVS", serviceSlugs: ["vvs"] };
  }
  if (code === "43.341") {
    return { categorySlug: "maleri", categoryLabel: "Måleri", serviceSlugs: ["malning"] };
  }
  if (code === "43.320") {
    return { categorySlug: "snickeri", categoryLabel: "Snickeri", serviceSlugs: ["snickeri"] };
  }
  if (code === "81.300") {
    return { categorySlug: "tradgard", categoryLabel: "Trädgård", serviceSlugs: ["tradgardshjalp"] };
  }

  return null;
}

export function slugifyDirectoryBusiness(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "foretag";
}

export function buildDirectoryPublicSlug(candidate: Pick<NormalizedDirectoryCandidate, "displayName" | "legalName" | "organizationNumber">) {
  const namePart = slugifyDirectoryBusiness(candidate.displayName || candidate.legalName);
  const orgSuffix = candidate.organizationNumber.replace(/[^0-9a-z]/gi, "").slice(-6).toLowerCase();
  return `${namePart}-${orgSuffix || "profil"}`.slice(0, 110);
}

export function assessDirectoryCandidate(candidate: NormalizedDirectoryCandidate): DirectoryQualityAssessment {
  const reasons: string[] = [];
  const category = mapSniToDirectoryCategory(candidate.primarySniCode);
  const pilotLocation = isDirectoryPilotLocation(candidate);
  let score = 0;

  if (candidate.isActive) score += 25;
  else reasons.push("organization_inactive");

  if (candidate.legalName.trim()) score += 15;
  else reasons.push("missing_legal_name");

  if (candidate.organizationKind === "juridical_person") score += 15;
  else reasons.push(candidate.organizationKind === "sole_trader" ? "sole_trader_privacy_guard" : "unknown_legal_form");

  if (category) score += 20;
  else reasons.push("unsupported_sni");

  if (candidate.city.trim()) score += 10;
  else reasons.push("missing_city");

  if (!pilotLocation) reasons.push("outside_pilot_area");

  if (candidate.addressLine1.trim() && candidate.postalCode.trim()) score += 5;
  else reasons.push("incomplete_address");

  if (candidate.officialSource.trim()) score += 5;
  else reasons.push("missing_official_source");

  if (isPositiveRegistrationSignal(candidate.fTaxStatus) || isPositiveRegistrationSignal(candidate.vatStatus)) score += 5;
  else reasons.push("tax_status_not_confirmed");

  const privacyBlocked = candidate.organizationKind !== "juridical_person";
  const autoPublicEligible = candidate.isActive
    && !privacyBlocked
    && Boolean(category)
    && Boolean(candidate.city.trim())
    && pilotLocation;

  let publicationStatus: DirectoryQualityAssessment["publicationStatus"] = "review";
  if (!candidate.isActive) publicationStatus = "inactive";
  else if (privacyBlocked) publicationStatus = "blocked";
  else if (autoPublicEligible && score >= 80) publicationStatus = "ready";

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    privacyBlocked,
    autoPublicEligible,
    publicationStatus,
    category,
  };
}
