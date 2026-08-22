"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  hashMarketplaceCustomerComparisonToken,
  marketplaceCustomerComparisonPath,
  selectMarketplaceCustomerOffer,
} from "@/lib/marketplace-customer-comparison";
import { allowPublicSubmission } from "@/lib/public-form-protection";

function localeFrom(formData: FormData) {
  return formData.get("lang") === "en" ? "en" as const : "sv" as const;
}

function redirectWithState(token: string, locale: "sv" | "en", status: string): never {
  const query = new URLSearchParams({ status });
  if (locale === "en") query.set("lang", "en");
  redirect(`${marketplaceCustomerComparisonPath(token)}?${query.toString()}`);
}

export async function selectMarketplaceCustomerOfferAction(token: string, formData: FormData) {
  const locale = localeFrom(formData);
  const offerId = String(formData.get("offerId") ?? "").trim();
  if (!offerId) redirectWithState(token, locale, "invalid");

  const requestHeaders = await headers();
  const allowed = await allowPublicSubmission({
    scope: "marketplace-customer-selection",
    requestHeaders,
    identity: hashMarketplaceCustomerComparisonToken(token),
    maxAttempts: 5,
    windowSeconds: 30 * 60,
  });
  if (!allowed) redirectWithState(token, locale, "rate_limited");

  const result = await selectMarketplaceCustomerOffer(token, offerId);
  if (result.ok) redirectWithState(token, locale, "selected");
  redirectWithState(token, locale, result.code);
}
