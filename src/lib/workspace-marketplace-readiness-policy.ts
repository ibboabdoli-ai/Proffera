export type MarketplaceServiceSnapshot = {
  isActive: boolean;
  publicStatus: string;
  conversionMode: string;
  serviceArea: string;
};

export type MarketplaceReadinessInput = {
  claimVerified: boolean;
  contactEmailValid: boolean;
  leadManagementAccess: boolean;
  services: MarketplaceServiceSnapshot[];
};

export type MarketplaceReadiness = {
  claimReady: boolean;
  contactReady: boolean;
  entitlementReady: boolean;
  leadServiceReady: boolean;
  serviceAreaReady: boolean;
  ready: boolean;
};

export function isMarketplaceLeadConversionMode(value: string) {
  return value === "quote" || value === "book_or_quote" || value === "contact";
}

export function resolveMarketplaceReadiness(input: MarketplaceReadinessInput): MarketplaceReadiness {
  const leadServices = input.services.filter(
    (service) =>
      service.isActive
      && service.publicStatus === "published"
      && isMarketplaceLeadConversionMode(service.conversionMode),
  );
  const leadServiceReady = leadServices.length > 0;
  const serviceAreaReady = leadServices.some((service) => service.serviceArea.trim().length > 0);

  const result = {
    claimReady: input.claimVerified,
    contactReady: input.contactEmailValid,
    entitlementReady: input.leadManagementAccess,
    leadServiceReady,
    serviceAreaReady,
  };

  return {
    ...result,
    ready: Object.values(result).every(Boolean),
  };
}
