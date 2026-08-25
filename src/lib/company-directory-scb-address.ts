export type DirectoryPublicAddress = {
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
};

export type DirectoryPublicAddressResolution = {
  address: DirectoryPublicAddress;
  source: "profile" | "scb_workplace";
  sourceIndex: number | null;
};

export type DirectoryCanonicalWorkplaceResolution =
  | {
      status: "resolved";
      address: DirectoryPublicAddress;
      sourceIndex: number;
    }
  | {
      status: "unavailable";
      reason: "no_workplaces" | "no_complete_workplace" | "ambiguous_workplaces";
      address: null;
      sourceIndex: null;
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

/** Extract one fully coherent physical location from an SCB workplace. */
function workplaceVisitingAddress(value: unknown, sourceIndex: number): ScbWorkplaceAddress | null {
  const workplace = record(value);
  const visiting = record(workplace?.visitingAddress);
  const addressLine1 = text(visiting?.addressLine);
  const postalCode = displayPostalCode(visiting?.postalCode);
  const city = text(visiting?.city);
  const municipality = text(workplace?.municipality);
  if (!addressLine1 || !postalCode || !city || !municipality) return null;

  return {
    addressLine1,
    postalCode,
    city,
    municipality,
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

function profileResolution(address: DirectoryPublicAddress): DirectoryPublicAddressResolution {
  return { address, source: "profile", sourceIndex: null };
}

function workplaceResolution(address: ScbWorkplaceAddress): DirectoryPublicAddressResolution {
  return {
    address: selectedAddress(address),
    source: "scb_workplace",
    sourceIndex: address.sourceIndex,
  };
}

/**
 * Resolve the canonical physical workplace location without falling back to a
 * registered/company/postal address.
 *
 * This is the source-of-truth contract for physical Search/Map/distance use.
 * A result is returned only when one complete SCB Arbetsställe visiting-address
 * bundle can be selected safely. Otherwise the result is explicitly unavailable
 * so downstream code cannot accidentally present a postal address as a physical
 * workplace location.
 */
export function resolveCompanyDirectoryCanonicalWorkplaceAddress(
  profile: DirectoryPublicAddress,
  workplaces: unknown,
): DirectoryCanonicalWorkplaceResolution {
  if (!Array.isArray(workplaces) || workplaces.length === 0) {
    return {
      status: "unavailable",
      reason: "no_workplaces",
      address: null,
      sourceIndex: null,
    };
  }

  const complete = workplaces
    .map((value, index) => workplaceVisitingAddress(value, index))
    .filter((value): value is ScbWorkplaceAddress => Boolean(value));
  if (complete.length === 0) {
    return {
      status: "unavailable",
      reason: "no_complete_workplace",
      address: null,
      sourceIndex: null,
    };
  }

  if (workplaces.length === 1 && complete.length === 1) {
    return {
      status: "resolved",
      address: selectedAddress(complete[0]),
      sourceIndex: complete[0].sourceIndex,
    };
  }

  const normalizedStreet = normalizeText(profile.addressLine1);
  if (normalizedStreet) {
    const streetMatch = uniqueMatch(
      complete,
      (address) => normalizeText(address.addressLine1) === normalizedStreet,
    );
    if (streetMatch) {
      return {
        status: "resolved",
        address: selectedAddress(streetMatch),
        sourceIndex: streetMatch.sourceIndex,
      };
    }
  }

  const normalizedPostal = normalizePostalCode(profile.postalCode);
  const normalizedCity = normalizeText(profile.city);
  if (normalizedPostal && normalizedCity) {
    const postalMatch = uniqueMatch(
      complete,
      (address) => normalizePostalCode(address.postalCode) === normalizedPostal
        && normalizeText(address.city) === normalizedCity,
    );
    if (postalMatch) {
      return {
        status: "resolved",
        address: selectedAddress(postalMatch),
        sourceIndex: postalMatch.sourceIndex,
      };
    }
  }

  return {
    status: "unavailable",
    reason: "ambiguous_workplaces",
    address: null,
    sourceIndex: null,
  };
}

/**
 * Resolve a customer-facing address and report which source actually won.
 *
 * SCB company-level municipality describes the registered seat and is not a
 * physical service/workplace location. Only a complete selected workplace
 * visiting-address bundle may therefore replace the profile location.
 *
 * Legacy/profile fallback remains here for existing callers that still render
 * registered/postal facts. New physical-location consumers should use
 * resolveCompanyDirectoryCanonicalWorkplaceAddress and fail closed when it is
 * unavailable.
 */
export function resolveCompanyDirectoryPublicAddressResolution(
  profile: DirectoryPublicAddress,
  workplaces: unknown,
): DirectoryPublicAddressResolution {
  const fallback = {
    addressLine1: text(profile.addressLine1),
    postalCode: text(profile.postalCode),
    city: text(profile.city),
    municipality: text(profile.municipality),
  };
  const canonical = resolveCompanyDirectoryCanonicalWorkplaceAddress(fallback, workplaces);
  if (canonical.status === "resolved") {
    return {
      address: canonical.address,
      source: "scb_workplace",
      sourceIndex: canonical.sourceIndex,
    };
  }
  return profileResolution(fallback);
}

/**
 * Resolve a customer-facing address without confusing SCB postal addresses
 * (which may be a PO box) with a workplace visiting address.
 *
 * A true single-workplace company can safely use its complete visiting address.
 * Multi-workplace companies are only switched when one workplace uniquely
 * matches the profile's current street or postal-code/city pair. Otherwise the
 * existing profile address remains the legacy fallback.
 *
 * Street, postcode, city and workplace municipality are treated as one coherent
 * location bundle; partial SCB locations never replace profile location data.
 */
export function resolveCompanyDirectoryPublicAddress(
  profile: DirectoryPublicAddress,
  workplaces: unknown,
): DirectoryPublicAddress {
  return resolveCompanyDirectoryPublicAddressResolution(profile, workplaces).address;
}
