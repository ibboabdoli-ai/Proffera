"use server";

import { redirect } from "next/navigation";

import {
  respondToPublicWorkspaceQuoteOffer,
  type PublicWorkspaceQuoteOfferResponse,
} from "@/lib/workspace-quote-offers-db";
import { publicWorkspaceQuoteOfferPath } from "@/lib/workspace-quote-offer-public";

function localeFrom(formData: FormData) {
  return formData.get("lang") === "en" ? "en" : "sv";
}

function redirectWithState(token: string, locale: "sv" | "en", state: string) {
  const query = new URLSearchParams({ response: state });
  if (locale === "en") query.set("lang", "en");
  redirect(`${publicWorkspaceQuoteOfferPath(token)}?${query.toString()}`);
}

export async function respondToPublicQuoteOfferAction(token: string, formData: FormData) {
  const locale = localeFrom(formData);
  const decision = formData.get("decision");

  if (decision !== "accepted" && decision !== "rejected") {
    redirectWithState(token, locale, "invalid");
  }

  const result = await respondToPublicWorkspaceQuoteOffer(token, decision as PublicWorkspaceQuoteOfferResponse);
  redirectWithState(token, locale, result.ok ? result.response : "invalid");
}
