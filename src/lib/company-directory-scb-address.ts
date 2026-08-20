export type DirectoryPublicAddress = {
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
};

type ScbWorkplaceAddress = DirectoryPublicAddress & {
  sourceIndex: number;
};

/** Convert an unknown value into trimmed text without leaking nullish values. */
function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

/** Return a plain object view for structured SCB values. */
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Normalize Swedish text for stable address comparisons. */
function normalizeText(value: unknown) {
  return text(value)
    .normalize("NFKC")
    .toLocaleLowerCase("sv-SE")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/** Normalize postal codes to digits only for equality checks. */
function normalizePostalCode(value: unknown) {
  return text(value).replace(/\D/g, "");
}

/** Format a five-digit Swedish postal code for public display. */
function displayPostalCode(value: unknown) {
  const digits = normalizePostalCode(value);
  return digits.length === 5 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : text(value);
}

/** Extract a complete visiting address from one SCB workplace. */
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

/** Return a match only when exactly one workplace satisfies the predicate. */
function uniqueMatch(
  addresses: ScbWorkplaceAddress[],
  predicate: (address: ScbWorkplaceAddress) => boolean,
) {
  const matches = addresses.filter(predicate);
  return matches.length === 1 ? matches[0] : null;
}

/** Project one selected SCB workplace into the public address shape. */
function selectedAddress(address: ScbWorkplaceAddress): DirectoryPublicAddress {
  return {
    addressLine1: address.addressLine1,
    postalCode: address.postalCode,
    city: address.city,
    municipality: address.municipality,
  };
}

/**
 * Resolve a customer-facing address without confusing SCB postal addresses
 * (which may be a PO box) with a workplace visiting address.
 *
 * A true single-workplace company can safely use its complete visiting address.
 * Multi-workplace companies are only switched when one workplace uniquely
 * matches the profile's current street or postal-code/city pair. Otherwise the
 * existing profile address remains the safe, non-guessed fallback.
 *
 * The selected SCB address is kept coherent: municipality is never borrowed
 * from the old profile address when SCB did not provide it for that workplace.
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
  if (workplaces.length === 1 && complete.length === 1) {
    return selectedAddress(complete[0]);
  }

  const normalizedStreet = normalizeText(fallback.addressLine1);
  if (normalizedStreet) {
    const streetMatch = uniqueMatch(
      complete,
      (address) => normalizeText(address.addressLine1) === normalizedStreet,
    );
    if (streetMatch) return selectedAddress(streetMatch);
  }

  const normalizedPostal = normalizePostalCode(fallback.postalCode);
  const normalizedCity = normalizeText(fallback.city);
  if (normalizedPostal && normalizedCity) {
    const postalMatch = uniqueMatch(
      complete,
      (address) => normalizePostalCode(address.postalCode) === normalizedPostal
        && normalizeText(address.city) === normalizedCity,
    );
    if (postalMatch) return selectedAddress(postalMatch);
  }

  return fallback;
}
