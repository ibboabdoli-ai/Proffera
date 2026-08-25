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

function completeWorkplaceAddresses(workplaces: unknown) {
  if (!Array.isArray(workplaces)) return [] as ScbWorkplaceAddress[];
  return workplaces
    .map((value, index) => workplaceVisitingAddress(value, index))
    .filter((value): value is ScbWorkplaceAddress => Boolean(value));
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
 * A result is returned only for one complete SCB Arbetsställe visiting-address
 * bundle. Multi-workplace companies stay fail-closed until a separate trusted
 * workplace-selection signal exists; the current profile address cannot safely
 * disambiguate them because it may itself be a company/postal address.
 */
export function resolveCompanyDirectoryCanonicalWorkplaceAddress(
  _profile: DirectoryPublicAddress,
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

  const complete = completeWorkplaceAddresses(workplaces);
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
 * Legacy/profile fallback remains here for existing callers until dependent
 * reprojection/read-path slices migrate to the strict canonical resolver.
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

  // Preserve the pre-existing read behavior for multi-workplace profiles while
  // the new strict physical-location contract is adopted by downstream slices.
  // This compatibility path is intentionally not used by the canonical resolver.
  const complete = completeWorkplaceAddresses(workplaces);
  if (complete.length > 0) {
    const normalizedStreet = normalizeText(fallback.addressLine1);
    if (normalizedStreet) {
      const streetMatch = uniqueMatch(
        complete,
        (address) => normalizeText(address.addressLine1) === normalizedStreet,
      );
      if (streetMatch) return workplaceResolution(streetMatch);
    }

    const normalizedPostal = normalizePostalCode(fallback.postalCode);
    const normalizedCity = normalizeText(fallback.city);
    if (normalizedPostal && normalizedCity) {
      const postalMatch = uniqueMatch(
        complete,
        (address) => normalizePostalCode(address.postalCode) === normalizedPostal
          && normalizeText(address.city) === normalizedCity,
      );
      if (postalMatch) return workplaceResolution(postalMatch);
    }
  }

  return profileResolution(fallback);
}

/**
 * Resolve a customer-facing address without confusing SCB postal addresses
 * (which may be a PO box) with a workplace visiting address.
 *
 * A true single-workplace company can safely use its complete visiting address.
 * The compatibility resolver may still reuse the old unique multi-workplace
 * match for existing callers, while physical-location consumers should use the
 * strict canonical resolver and fail closed.
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
