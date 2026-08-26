export type MarketplaceClaimPaidCtaLocale = "sv" | "en";

export function normalizeMarketplaceClaimPaidCtaLocale(lang: string | null | undefined): MarketplaceClaimPaidCtaLocale {
  return lang === "en" ? "en" : "sv";
}

export function getMarketplaceClaimPaidCtaCopy(locale: MarketplaceClaimPaidCtaLocale) {
  if (locale === "en") {
    return {
      eyebrow: "Next step",
      title: "Plans and billing",
      description: "Your company profile is connected. Review Starter and Professional in Settings to activate or manage paid marketplace tools.",
      action: "Open plans",
      href: "/dashboard/installningar?lang=en&plan=starter",
    } as const;
  }

  return {
    eyebrow: "Nästa steg",
    title: "Plan och fakturering",
    description: "Din företagsprofil är kopplad. Se Starter och Professional i Inställningar för att aktivera eller hantera betalda marknadsplatsverktyg.",
    action: "Öppna planer",
    href: "/dashboard/installningar?lang=sv&plan=starter",
  } as const;
}
