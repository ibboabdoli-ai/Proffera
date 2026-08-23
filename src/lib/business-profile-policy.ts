export type BusinessProfileFieldSource = "official" | "owner" | "proffera";
export type BusinessProfileOwnershipState = "unclaimed" | "claimed";
export type BusinessProfileConversionMode = "book" | "quote" | "book_or_quote" | "contact";

export type BusinessProfileResolvedText = {
  value: string;
  source: "official" | "owner";
};

export type BusinessProfilePublicContactSource = {
  entitled: boolean;
  addressLine1: string;
  phone: string;
  email: string;
  website: string;
  available: {
    addressLine1: boolean;
    phone: boolean;
    email: boolean;
    website: boolean;
  };
};

export type BusinessProfileDirectoryServiceSource = {
  slug: string;
  label: string;
  confirmed: boolean;
};

export type BusinessProfileOwnerServiceSource = {
  id: string;
  name: string;
  description: string;
  publicSlug: string;
  canonicalServiceSlug: string;
  conversionMode: BusinessProfileConversionMode | string | null;
};

export type BusinessProfileServiceAreaSource = {
  serviceSlug: string;
  serviceLabel: string;
  radiusKm: number;
};

export type BusinessProfileReputationSource = {
  rating: number;
  verifiedReviews: number;
  completedJobs: number;
  customerCancellations: number;
  providerCancellations: number;
  noShows: number;
  problemJobs: number;
};

export type BusinessProfileOfficialSource = {
  profileId: string;
  directorySlug: string;
  claimedWorkspaceId: string | null;
  legalName: string;
  displayName: string;
  legalForm: string;
  organizationStatus: string;
  organizationNumber: string;
  categorySlug: string;
  primarySniCode: string;
  primarySniLabel: string;
  activityDescription: string;
  publicLocation: {
    addressLine1: string;
    postalCode: string;
    city: string;
    municipality: string;
  };
  media: null | {
    url: string;
    kind: string;
    attribution: string;
    isActualBusinessMedia: boolean;
  };
};

export type BusinessProfileOwnerSource = {
  workspaceId: string;
  workspaceSlug: string;
  bookingSlug: string;
  companyName: string;
  businessIntro: string;
  logoUrl: string;
  heroImageUrl: string;
  featuredMediaUrl: string;
  services: BusinessProfileOwnerServiceSource[];
};

export type BusinessProfileEntitlements = {
  workspaceId: string;
  directContact: boolean;
  richWebsite: boolean;
  onlineBooking: boolean;
};

export type BusinessProfileResolveInput = {
  official: BusinessProfileOfficialSource;
  owner?: BusinessProfileOwnerSource | null;
  directoryServices?: BusinessProfileDirectoryServiceSource[];
  serviceAreas?: BusinessProfileServiceAreaSource[];
  reputation?: BusinessProfileReputationSource | null;
  publicContact?: BusinessProfilePublicContactSource | null;
  entitlements?: BusinessProfileEntitlements | null;
};

export type ResolvedBusinessProfileService = {
  id: string | null;
  name: string;
  description: string;
  canonicalServiceSlug: string | null;
  publicSlug: string | null;
  conversionMode: BusinessProfileConversionMode | null;
  source: "owner" | "proffera";
};

export type ResolvedBusinessProfileMedia = {
  url: string;
  role: "hero" | "featured" | "business_photo" | "logo" | "illustration";
  source: "owner" | "proffera";
  kind: string;
  attribution: string;
};

export type ResolvedBusinessProfile = {
  identity: {
    profileId: string;
    directorySlug: string;
    ownershipState: BusinessProfileOwnershipState;
    claimedWorkspaceId: string | null;
    workspaceSlug: string | null;
    bookingSlug: string | null;
  };
  legal: {
    legalName: string;
    legalForm: string;
    organizationStatus: string;
    organizationNumber: string;
    primarySniCode: string;
    primarySniLabel: string;
  };
  presentation: {
    displayName: BusinessProfileResolvedText;
    description: BusinessProfileResolvedText;
    categorySlug: string;
    media: ResolvedBusinessProfileMedia | null;
  };
  location: {
    addressLine1: string;
    postalCode: string;
    city: string;
    municipality: string;
  };
  contact: BusinessProfilePublicContactSource;
  services: ResolvedBusinessProfileService[];
  serviceAreas: BusinessProfileServiceAreaSource[];
  reputation: BusinessProfileReputationSource | null;
  capabilities: {
    directContact: boolean;
    richWebsite: boolean;
    onlineBooking: boolean;
    mediatedQuote: true;
  };
};

export type PublicProfileBusinessProjection = {
  profileId: string;
  directorySlug: string;
  ownershipState: BusinessProfileOwnershipState;
  workspaceSlug: string | null;
  bookingSlug: string | null;
  displayName: string;
  displayNameSource: "official" | "owner";
  description: string;
  descriptionSource: "official" | "owner";
  categorySlug: string;
  legal: ResolvedBusinessProfile["legal"];
  location: ResolvedBusinessProfile["location"];
  contact: BusinessProfilePublicContactSource;
  media: ResolvedBusinessProfileMedia | null;
  services: ResolvedBusinessProfileService[];
  reputation: null | {
    rating: number;
    verifiedReviews: number;
    completedJobs: number;
  };
  capabilities: ResolvedBusinessProfile["capabilities"];
};

export type SearchCardBusinessProjection = {
  profileId: string;
  directorySlug: string;
  workspaceSlug: string | null;
  displayName: string;
  categorySlug: string;
  city: string;
  municipality: string;
  media: ResolvedBusinessProfileMedia | null;
  canonicalServiceSlugs: string[];
  reputation: null | {
    rating: number;
    verifiedReviews: number;
  };
  capabilities: {
    richWebsite: boolean;
    onlineBooking: boolean;
    mediatedQuote: true;
  };
};

export type MarketplaceProviderBusinessProjection = {
  profileId: string;
  claimedWorkspaceId: string | null;
  categorySlug: string;
  services: Array<{
    workspaceServiceId: string | null;
    canonicalServiceSlug: string;
    conversionMode: BusinessProfileConversionMode | null;
  }>;
  serviceAreas: BusinessProfileServiceAreaSource[];
  reputation: BusinessProfileReputationSource | null;
  capabilities: ResolvedBusinessProfile["capabilities"];
};

export type SeoBusinessProjection = {
  profileId: string;
  directorySlug: string;
  displayName: string;
  description: string;
  categorySlug: string;
  city: string;
  municipality: string;
  streetAddress: string;
  mediaUrl: string;
  rating: number | null;
  verifiedReviews: number;
  contact: {
    phone: string;
    email: string;
    website: string;
  };
};

const EMPTY_CONTACT: BusinessProfilePublicContactSource = {
  entitled: false,
  addressLine1: "",
  phone: "",
  email: "",
  website: "",
  available: {
    addressLine1: false,
    phone: false,
    email: false,
    website: false,
  },
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullableText(value: unknown) {
  const normalized = text(value);
  return normalized || null;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function conversionMode(value: unknown): BusinessProfileConversionMode | null {
  return value === "book" || value === "quote" || value === "book_or_quote" || value === "contact"
    ? value
    : null;
}

function resolveTextField(
  officialValue: unknown,
  ownerValue: unknown,
  ownerBound: boolean,
): BusinessProfileResolvedText {
  const ownerText = ownerBound ? text(ownerValue) : "";
  if (ownerText) return { value: ownerText, source: "owner" };
  return { value: text(officialValue), source: "official" };
}

function normalizeContact(
  contact: BusinessProfilePublicContactSource | null | undefined,
  directContact: boolean,
): BusinessProfilePublicContactSource {
  const source = contact ?? EMPTY_CONTACT;
  const available = {
    addressLine1: Boolean(source.available?.addressLine1),
    phone: Boolean(source.available?.phone),
    email: Boolean(source.available?.email),
    website: Boolean(source.available?.website),
  };
  const entitled = Boolean(directContact && source.entitled);
  return {
    entitled,
    addressLine1: entitled ? text(source.addressLine1) : "",
    phone: entitled ? text(source.phone) : "",
    email: entitled ? text(source.email) : "",
    website: entitled ? text(source.website) : "",
    available,
  };
}

function resolveServices(
  owner: BusinessProfileOwnerSource | null | undefined,
  ownerBound: boolean,
  directoryServices: BusinessProfileDirectoryServiceSource[],
): ResolvedBusinessProfileService[] {
  const ownerServices = ownerBound
    ? owner?.services
      .map((service): ResolvedBusinessProfileService => ({
        id: nullableText(service.id),
        name: text(service.name),
        description: text(service.description),
        canonicalServiceSlug: nullableText(service.canonicalServiceSlug),
        publicSlug: nullableText(service.publicSlug),
        conversionMode: conversionMode(service.conversionMode),
        source: "owner",
      }))
      .filter((service) => Boolean(service.name || service.canonicalServiceSlug || service.publicSlug)) ?? []
    : [];

  if (ownerServices.length > 0) return ownerServices;

  const seen = new Set<string>();
  return directoryServices
    .filter((service) => service.confirmed)
    .map((service): ResolvedBusinessProfileService | null => {
      const slug = text(service.slug);
      if (!slug || seen.has(slug)) return null;
      seen.add(slug);
      return {
        id: null,
        name: text(service.label) || slug,
        description: "",
        canonicalServiceSlug: slug,
        publicSlug: null,
        conversionMode: null,
        source: "proffera",
      };
    })
    .filter((service): service is ResolvedBusinessProfileService => service !== null);
}

function resolveMedia(
  official: BusinessProfileOfficialSource,
  owner: BusinessProfileOwnerSource | null | undefined,
  ownerBound: boolean,
): ResolvedBusinessProfileMedia | null {
  const hero = ownerBound ? text(owner?.heroImageUrl) : "";
  if (hero) {
    return { url: hero, role: "hero", source: "owner", kind: "image", attribution: "" };
  }

  const featured = ownerBound ? text(owner?.featuredMediaUrl) : "";
  if (featured) {
    return { url: featured, role: "featured", source: "owner", kind: "image", attribution: "" };
  }

  const directoryMediaUrl = text(official.media?.url);
  if (directoryMediaUrl && official.media?.isActualBusinessMedia) {
    return {
      url: directoryMediaUrl,
      role: "business_photo",
      source: "proffera",
      kind: text(official.media.kind) || "image",
      attribution: text(official.media.attribution),
    };
  }

  const logo = ownerBound ? text(owner?.logoUrl) : "";
  if (logo) {
    return { url: logo, role: "logo", source: "owner", kind: "image", attribution: "" };
  }

  if (directoryMediaUrl) {
    return {
      url: directoryMediaUrl,
      role: "illustration",
      source: "proffera",
      kind: text(official.media?.kind) || "image",
      attribution: text(official.media?.attribution),
    };
  }

  return null;
}

function normalizeReputation(
  reputation: BusinessProfileReputationSource | null | undefined,
): BusinessProfileReputationSource | null {
  if (!reputation) return null;
  return {
    rating: finiteNumber(reputation.rating),
    verifiedReviews: Math.max(0, finiteNumber(reputation.verifiedReviews)),
    completedJobs: Math.max(0, finiteNumber(reputation.completedJobs)),
    customerCancellations: Math.max(0, finiteNumber(reputation.customerCancellations)),
    providerCancellations: Math.max(0, finiteNumber(reputation.providerCancellations)),
    noShows: Math.max(0, finiteNumber(reputation.noShows)),
    problemJobs: Math.max(0, finiteNumber(reputation.problemJobs)),
  };
}

function normalizeServiceAreas(serviceAreas: BusinessProfileServiceAreaSource[]) {
  return serviceAreas
    .map((area) => ({
      serviceSlug: text(area.serviceSlug),
      serviceLabel: text(area.serviceLabel),
      radiusKm: finiteNumber(area.radiusKm),
    }))
    .filter((area) => area.radiusKm > 0);
}

export function resolveBusinessProfilePolicy(input: BusinessProfileResolveInput): ResolvedBusinessProfile {
  const claimedWorkspaceId = nullableText(input.official.claimedWorkspaceId);
  const ownerBound = Boolean(
    claimedWorkspaceId
    && input.owner
    && text(input.owner.workspaceId).toLowerCase() === claimedWorkspaceId.toLowerCase(),
  );
  const entitlementBound = Boolean(
    claimedWorkspaceId
    && input.entitlements
    && text(input.entitlements.workspaceId).toLowerCase() === claimedWorkspaceId.toLowerCase(),
  );

  const directContact = Boolean(entitlementBound && input.entitlements?.directContact);
  const richWebsite = Boolean(entitlementBound && ownerBound && input.entitlements?.richWebsite);
  const onlineBooking = Boolean(entitlementBound && ownerBound && input.entitlements?.onlineBooking);
  const contact = normalizeContact(input.publicContact, directContact);

  return {
    identity: {
      profileId: text(input.official.profileId),
      directorySlug: text(input.official.directorySlug),
      ownershipState: claimedWorkspaceId ? "claimed" : "unclaimed",
      claimedWorkspaceId,
      workspaceSlug: ownerBound ? nullableText(input.owner?.workspaceSlug) : null,
      bookingSlug: ownerBound ? nullableText(input.owner?.bookingSlug) : null,
    },
    legal: {
      legalName: text(input.official.legalName),
      legalForm: text(input.official.legalForm),
      organizationStatus: text(input.official.organizationStatus),
      organizationNumber: text(input.official.organizationNumber),
      primarySniCode: text(input.official.primarySniCode),
      primarySniLabel: text(input.official.primarySniLabel),
    },
    presentation: {
      displayName: resolveTextField(input.official.displayName, input.owner?.companyName, ownerBound),
      description: resolveTextField(input.official.activityDescription, input.owner?.businessIntro, ownerBound),
      categorySlug: text(input.official.categorySlug),
      media: resolveMedia(input.official, input.owner, ownerBound),
    },
    location: {
      addressLine1: contact.addressLine1,
      postalCode: text(input.official.publicLocation.postalCode),
      city: text(input.official.publicLocation.city),
      municipality: text(input.official.publicLocation.municipality),
    },
    contact,
    services: resolveServices(input.owner, ownerBound, input.directoryServices ?? []),
    serviceAreas: normalizeServiceAreas(input.serviceAreas ?? []),
    reputation: normalizeReputation(input.reputation),
    capabilities: {
      directContact,
      richWebsite,
      onlineBooking,
      mediatedQuote: true,
    },
  };
}

export function projectBusinessProfilePublicProfile(
  profile: ResolvedBusinessProfile,
): PublicProfileBusinessProjection {
  const reputation = profile.reputation
    ? {
        rating: profile.reputation.rating,
        verifiedReviews: profile.reputation.verifiedReviews,
        completedJobs: profile.reputation.completedJobs,
      }
    : null;

  return {
    profileId: profile.identity.profileId,
    directorySlug: profile.identity.directorySlug,
    ownershipState: profile.identity.ownershipState,
    workspaceSlug: profile.capabilities.richWebsite ? profile.identity.workspaceSlug : null,
    bookingSlug: profile.capabilities.onlineBooking ? profile.identity.bookingSlug : null,
    displayName: profile.presentation.displayName.value,
    displayNameSource: profile.presentation.displayName.source,
    description: profile.presentation.description.value,
    descriptionSource: profile.presentation.description.source,
    categorySlug: profile.presentation.categorySlug,
    legal: { ...profile.legal },
    location: { ...profile.location },
    contact: {
      ...profile.contact,
      available: { ...profile.contact.available },
    },
    media: profile.presentation.media ? { ...profile.presentation.media } : null,
    services: profile.services.map((service) => ({ ...service })),
    reputation,
    capabilities: { ...profile.capabilities },
  };
}

export function projectBusinessProfileSearchCard(
  profile: ResolvedBusinessProfile,
): SearchCardBusinessProjection {
  return {
    profileId: profile.identity.profileId,
    directorySlug: profile.identity.directorySlug,
    workspaceSlug: profile.capabilities.richWebsite ? profile.identity.workspaceSlug : null,
    displayName: profile.presentation.displayName.value,
    categorySlug: profile.presentation.categorySlug,
    city: profile.location.city,
    municipality: profile.location.municipality,
    media: profile.presentation.media ? { ...profile.presentation.media } : null,
    canonicalServiceSlugs: [...new Set(
      profile.services
        .map((service) => service.canonicalServiceSlug)
        .filter((slug): slug is string => Boolean(slug)),
    )],
    reputation: profile.reputation
      ? {
          rating: profile.reputation.rating,
          verifiedReviews: profile.reputation.verifiedReviews,
        }
      : null,
    capabilities: {
      richWebsite: profile.capabilities.richWebsite,
      onlineBooking: profile.capabilities.onlineBooking,
      mediatedQuote: true,
    },
  };
}

export function projectBusinessProfileMarketplaceProvider(
  profile: ResolvedBusinessProfile,
): MarketplaceProviderBusinessProjection {
  return {
    profileId: profile.identity.profileId,
    claimedWorkspaceId: profile.identity.claimedWorkspaceId,
    categorySlug: profile.presentation.categorySlug,
    services: profile.services
      .filter((service) => Boolean(service.canonicalServiceSlug))
      .map((service) => ({
        workspaceServiceId: service.id,
        canonicalServiceSlug: service.canonicalServiceSlug as string,
        conversionMode: service.conversionMode,
      })),
    serviceAreas: profile.serviceAreas.map((area) => ({ ...area })),
    reputation: profile.reputation ? { ...profile.reputation } : null,
    capabilities: { ...profile.capabilities },
  };
}

export function projectBusinessProfileSeo(profile: ResolvedBusinessProfile): SeoBusinessProjection {
  const contact = profile.capabilities.directContact
    ? {
        phone: profile.contact.phone,
        email: profile.contact.email,
        website: profile.contact.website,
      }
    : { phone: "", email: "", website: "" };
  return {
    profileId: profile.identity.profileId,
    directorySlug: profile.identity.directorySlug,
    displayName: profile.presentation.displayName.value,
    description: profile.presentation.description.value,
    categorySlug: profile.presentation.categorySlug,
    city: profile.location.city,
    municipality: profile.location.municipality,
    streetAddress: profile.capabilities.directContact ? profile.location.addressLine1 : "",
    mediaUrl: profile.presentation.media?.url ?? "",
    rating: profile.reputation && profile.reputation.verifiedReviews > 0 && profile.reputation.rating > 0
      ? profile.reputation.rating
      : null,
    verifiedReviews: profile.reputation?.verifiedReviews ?? 0,
    contact,
  };
}
