import { swedishCompanyNamesEquivalent } from "@/lib/company-directory-company-name";
import { mapSniToDirectoryCategory, normalizeSniCode } from "@/lib/company-directory-policy";

export const COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION = "2026-08-23.1";

export type CompanyDirectoryCategoryConfidenceLevel = "high" | "review" | "low";

export type CompanyDirectoryCategoryConfidenceInput = {
  categorySlug: string;
  primarySniCode: string;
  legalName: string;
  displayName: string;
  activityDescription: string;
  registeredNames?: unknown;
  sniCodes?: unknown;
};

export type CompanyDirectoryCategoryConfidence = {
  score: number;
  level: CompanyDirectoryCategoryConfidenceLevel;
  signals: string[];
  warnings: string[];
  competingCategories: string[];
  conflictingTextCategories: string[];
  officialFactsReady: boolean;
};

type UnknownRecord = Record<string, unknown>;

type RegisteredNameFact = {
  name: string;
  typeCode: string;
  specialBusinessDescription: string;
};

type SniFact = {
  code: string;
  label: string;
};

const categoryKeywords: Record<string, string[]> = {
  stadning: ["stadning", "stadservice", "lokalvard", "rengor", "fonsterputs", "hemstad", "kontorsstad"],
  elektriker: ["elektr", "elinstall", "eltekn", "elkraft", "elservice"],
  vvs: ["vvs", "rorlagg", "rorinstall", "varme", "sanitar", "sanitet", "ventilation", "kylinstall"],
  maleri: ["maleri", "malning"],
  snickeri: ["snicker", "byggnadssnicker", "carpentry"],
  tradgard: ["tradgard", "markskotsel", "gronyt", "landskap"],
  flytt: ["flytt", "moving"],
  hemservice: ["hemservice", "hushallsnara", "hushallstjanst", "homeservice"],
  frisor: ["frisor", "barber", "harvard", "harfrisering", "frisering"],
};

function object(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function fold(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o");
}

function swedishTokens(values: string[]) {
  return values
    .filter(Boolean)
    .join(" ")
    .normalize("NFC")
    .toLocaleLowerCase("sv-SE")
    .replace(/[^a-z0-9åäö]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function hasExactSwedishToken(values: string[], token: string) {
  const tokens = swedishTokens(values);
  if (!tokens.length) return false;
  const normalizedToken = token.normalize("NFC").toLocaleLowerCase("sv-SE");
  return tokens.includes(normalizedToken);
}

function hasSwedishTokenPrefix(values: string[], prefixes: string[]) {
  const tokens = swedishTokens(values);
  if (!tokens.length) return false;
  const normalizedPrefixes = prefixes.map((prefix) => prefix.normalize("NFC").toLocaleLowerCase("sv-SE"));
  return tokens.some((token) => normalizedPrefixes.some((prefix) => token.startsWith(prefix)));
}

function hasCategoryKeyword(categorySlug: string, values: string[]) {
  const keywords = categoryKeywords[categorySlug] ?? [];
  if (!keywords.length) return false;

  if (categorySlug === "stadning" && hasExactSwedishToken(values, "städ")) {
    return true;
  }

  // Preserve Swedish vowel identity for painting terms. Folding å/ä to "a" made
  // words such as "Mälarsanering" look like the stem "målar" and falsely signal
  // the Måleri category. Real painting words keep their own token prefixes.
  if (categorySlug === "maleri") {
    return hasSwedishTokenPrefix(values, [
      "måleri",
      "målar",
      "målning",
      "maleri",
      "malare",
      "malning",
    ]);
  }

  let sourceText = values.filter(Boolean).join(" \n ").normalize("NFC");

  if (categorySlug === "flytt") {
    sourceText = sourceText
      .toLocaleLowerCase("sv-SE")
      .replace(/flyttstäd[a-zåäö]*/g, " ");
  }

  const haystack = fold(sourceText);
  return keywords.some((keyword) => haystack.includes(keyword));
}

function categoriesWithKeywords(values: string[]) {
  return Object.keys(categoryKeywords)
    .filter((categorySlug) => hasCategoryKeyword(categorySlug, values))
    .sort();
}

function registeredNameFacts(value: unknown): RegisteredNameFact[] {
  return array(value).map((item) => {
    const row = object(item);
    return {
      name: text(row?.name),
      typeCode: text(row?.typeCode).toLocaleUpperCase("sv-SE"),
      specialBusinessDescription: text(row?.specialBusinessDescription),
    };
  }).filter((item) => item.name || item.specialBusinessDescription);
}

function sniFacts(value: unknown): SniFact[] {
  return array(value).map((item) => {
    const row = object(item);
    return {
      code: normalizeSniCode(row?.code),
      label: text(row?.label),
    };
  }).filter((item) => item.code);
}

function levelFor(score: number): CompanyDirectoryCategoryConfidenceLevel {
  if (score >= 95) return "high";
  if (score >= 80) return "review";
  return "low";
}

export function assessCompanyDirectoryCategoryConfidence(
  input: CompanyDirectoryCategoryConfidenceInput,
): CompanyDirectoryCategoryConfidence {
  const signals: string[] = [];
  const warnings: string[] = [];
  const registeredNames = registeredNameFacts(input.registeredNames);
  const officialSniCodes = sniFacts(input.sniCodes);
  const officialFactsReady = officialSniCodes.length > 0;
  let score = 0;

  const normalizedPrimarySniCode = normalizeSniCode(input.primarySniCode);
  const primaryCategory = mapSniToDirectoryCategory(normalizedPrimarySniCode)?.categorySlug ?? "";
  const primaryCategoryMatches = Boolean(primaryCategory && primaryCategory === input.categorySlug);
  if (primaryCategoryMatches) {
    score += 80;
    signals.push("Primär SNI matchar kategorin");
  } else {
    warnings.push("Primär SNI matchar inte profilens kategori");
  }

  const officialCategories = new Set(
    officialSniCodes
      .map((item) => mapSniToDirectoryCategory(item.code)?.categorySlug ?? "")
      .filter(Boolean),
  );
  const officialPrimarySniMatches = Boolean(
    normalizedPrimarySniCode
    && officialSniCodes.some((item) => normalizeSniCode(item.code) === normalizedPrimarySniCode),
  );

  if (officialFactsReady && officialPrimarySniMatches && officialCategories.has(input.categorySlug)) {
    score += 15;
    signals.push("Bolagsverkets/SCB:s SNI-lista bekräftar exakt primär SNI");
  } else if (officialFactsReady && officialCategories.has(input.categorySlug)) {
    warnings.push("Officiell SNI-lista stödjer kategorin men bekräftar inte exakt primär SNI");
  } else if (officialFactsReady) {
    warnings.push("Fullständig officiell SNI-lista bekräftar inte kategorin");
  } else {
    warnings.push("Official Facts saknas ännu");
  }

  const activitySupportsCategory = hasCategoryKeyword(input.categorySlug, [input.activityDescription]);
  if (activitySupportsCategory) {
    score += 10;
    signals.push("Verksamhetsbeskrivningen stödjer kategorin");
  }

  const registeredNameValues = registeredNames.map((item) => item.name).filter(Boolean);
  const nameSupportsCategory = hasCategoryKeyword(input.categorySlug, [
    input.legalName,
    input.displayName,
    ...registeredNameValues,
  ]);
  if (nameSupportsCategory) {
    score += 10;
    signals.push("Företagsnamn stödjer kategorin");
  }

  const specialBusinessDescriptions = registeredNames.map((item) => item.specialBusinessDescription);
  const specialDescriptionSupportsCategory = hasCategoryKeyword(input.categorySlug, specialBusinessDescriptions);
  if (specialDescriptionSupportsCategory) {
    score += 5;
    signals.push("Registrerad särskild verksamhetsbeskrivning stödjer kategorin");
  }

  const explicitOfficialCompanyNames = registeredNames
    .filter((item) => item.typeCode === "FORETAGSNAMN")
    .map((item) => item.name)
    .filter(Boolean);
  const officialCompanyNameValues = explicitOfficialCompanyNames.length > 0
    ? explicitOfficialCompanyNames
    : registeredNames.length === 1 && !registeredNames[0]?.typeCode
      ? registeredNameValues
      : [];
  const hasOfficialCompanyName = officialCompanyNameValues.length > 0;
  const profileNameMatchesOfficialFacts = !hasOfficialCompanyName
    || [input.legalName, input.displayName]
      .filter(Boolean)
      .some((profileName) => officialCompanyNameValues.some(
        (officialName) => swedishCompanyNamesEquivalent(profileName, officialName),
      ));
  if (hasOfficialCompanyName && profileNameMatchesOfficialFacts) {
    signals.push("Företagsnamnet matchar Official Facts");
  } else if (hasOfficialCompanyName) {
    score = Math.min(score, 90);
    warnings.push("Profilens företagsnamn matchar inte Official Facts");
  }

  const competingCategories = [...officialCategories].filter((category) => category !== input.categorySlug).sort();
  if (competingCategories.length) {
    const penalty = Math.min(15, competingCategories.length * 5);
    score -= penalty;
    score = Math.min(score, 90);
    warnings.push(`Andra stödda kategorier finns i SNI-listan: ${competingCategories.join(", ")}`);
  }

  const officialTextValues = [
    input.activityDescription,
    input.legalName,
    input.displayName,
    ...registeredNameValues,
    ...specialBusinessDescriptions,
  ];
  const conflictingTextCategories = categoriesWithKeywords(officialTextValues)
    .filter((category) => category !== input.categorySlug);
  if (conflictingTextCategories.length) {
    score = Math.min(score, 90);
    warnings.push(`Officiell företagstext stödjer även andra kategorier: ${conflictingTextCategories.join(", ")}`);
  }

  const hasIndependentTextSignal = activitySupportsCategory
    || nameSupportsCategory
    || specialDescriptionSupportsCategory;
  if (!hasIndependentTextSignal) {
    score = Math.min(score, 90);
    warnings.push("Ingen oberoende textsignal stödjer kategorin");
  }

  score = Math.max(0, Math.min(100, score));
  if (!officialFactsReady) score = Math.min(score, 80);
  if (officialFactsReady && primaryCategoryMatches && !officialPrimarySniMatches) {
    score = Math.min(score, 90);
  }

  return {
    score,
    level: levelFor(score),
    signals,
    warnings,
    competingCategories,
    conflictingTextCategories,
    officialFactsReady,
  };
}
