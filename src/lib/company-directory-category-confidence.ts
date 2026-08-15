import { mapSniToDirectoryCategory, normalizeSniCode } from "@/lib/company-directory-policy";

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
  maleri: ["maleri", "malar", "malning"],
  snickeri: ["snicker", "byggnadssnicker", "carpentry"],
  tradgard: ["tradgard", "markskotsel", "gronyt", "landskap"],
  flytt: ["flytt", "moving"],
  hemservice: ["hemservice", "hushallsnara", "hushallstjanst", "homeservice"],
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

function hasCategoryKeyword(categorySlug: string, values: string[]) {
  const keywords = categoryKeywords[categorySlug] ?? [];
  if (!keywords.length) return false;
  let haystack = fold(values.filter(Boolean).join(" \n "));

  // "Flyttstädning" is a cleaning service, not evidence that the company
  // offers moving services. Strip only the normalized cleaning compound
  // (flyttstadning...), while preserving legitimate moving names/terms such
  // as Flyttstaden, flyttfirma, flyttservice and flyttning.
  if (categorySlug === "flytt") {
    haystack = haystack.replace(/flytt[\s-]*stadn\w*/g, " ");
  }

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
    score += 65;
    signals.push("Primär SNI matchar kategorin");
  } else {
    warnings.push("Primär SNI matchar inte profilens kategori");
  }

  const officialCategories = new Set(
    officialSniCodes
      .map((item) => mapSniToDirectoryCategory(item.code)?.categorySlug ?? "")
      .filter(Boolean),
  );

  if (officialFactsReady && officialCategories.has(input.categorySlug)) {
    score += 15;
    signals.push("Bolagsverkets/SCB:s fullständiga SNI-lista bekräftar kategorin");
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

  const registeredNameValues = registeredNames.map((item) => item.name);
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
    warnings.push("Ingen oberoende textsignal stödjer kategorin");
  }

  score = Math.max(0, Math.min(100, score));
  if (!officialFactsReady) score = Math.min(score, 80);

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
