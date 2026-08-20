export type DirectoryPublicAddress = {
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
};

type ScbWorkplaceAddress = DirectoryPublicAddress & {
  sourceIndex: number;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeText(value: unknown) {
  return text(value)
    .normalize("NFKC")
    .toLocaleLowerCase("sv-SE")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function normalizePostalCode(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function displayPostalCode(value: unknown) {
  const digits = normalizePostalCode(value);
  return digits.length === 5 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : text(value);
}

function workplaceVisitingAddress(value: unknown, sourceIndex: number): ScbWorkplaceAddress | null {
  const workplace = record(value);
  const visiting = record(workplace?.visitingAddress);
  const addressLine1 = text(visiting?.addressLine);
  const postalCode = displayPostalCode(visiting?.postalCode);
  const city = text(visiting?.city);
  if (!addressLine1 || !postalCode || !city) return null;

  return {
    addressLine1,
    postalCode,
    city,
    municipality: text(workplace?.municipality),
    sourceIndex,
  };
}

function uniqueMatch(
  addresses: ScbWorkplaceAddress[],
  predicate: (address: ScbWorkplaceAddress) => boolean,
) {
  const matches = addresses.filter(predicate);
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Resolve a customer-facing address without confusing SCB postal addresses
 * (which may be a PO box) with a workplace visiting address.
 *
 * Single-workplace companies can safely use the complete visiting address.
 * Multi-workplace companies are only switched when one workplace uniquely
 * matches the profile's current street or postal-code/city pair. Otherwise the
 * existing profile address remains the safe, non-guessed fallback.
 */
export function resolveCompanyDirectoryPublicAddress(
  profile: DirectoryPublicAddress,
  workplaces: unknown,
): DirectoryPublicAddress {
  const fallback = {
    addressLine1: text(profile.addressLine1),
    postalCode: text(profile.postalCode),
    city: text(profile.city),
    municipality: text(profile.municipality),
  };
  if (!Array.isArray(workplaces)) return fallback;

  const complete = workplaces
    .map((value, index) => workplaceVisitingAddress(value, index))
    .filter((value): value is ScbWorkplaceAddress => Boolean(value));
  if (complete.length === 0) return fallback;
  if (complete.length === 1) {
    const selected = complete[0];
    return {
      addressLine1: selected.addressLine1,
      postalCode: selected.postalCode,
      city: selected.city,
      municipality: selected.municipality || fallback.municipality,
    };
  }

  const normalizedStreet = normalizeText(fallback.addressLine1);
  if (normalizedStreet) {
    const streetMatch = uniqueMatch(
      complete,
      (address) => normalizeText(address.addressLine1) === normalizedStreet,
    );
    if (streetMatch) {
      return {
        addressLine1: streetMatch.addressLine1,
        postalCode: streetMatch.postalCode,
        city: streetMatch.city,
        municipality: streetMatch.municipality || fallback.municipality,
      };
    }
  }

  const normalizedPostal = normalizePostalCode(fallback.postalCode);
  const normalizedCity = normalizeText(fallback.city);
  if (normalizedPostal) {
    const postalMatch = uniqueMatch(
      complete,
      (address) => normalizePostalCode(address.postalCode) === normalizedPostal
        && (!normalizedCity || normalizeText(address.city) === normalizedCity),
    );
    if (postalMatch) {
      return {
        addressLine1: postalMatch.addressLine1,
        postalCode: postalMatch.postalCode,
        city: postalMatch.city,
        municipality: postalMatch.municipality || fallback.municipality,
      };
    }
  }

  return fallback;
}
